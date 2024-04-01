import {ReactElement} from "react";
import {Extension, ExtensionResponse, InitialData, Message} from "chub-extensions-ts";
import {LoadResponse} from "chub-extensions-ts/dist/types/load";
import {env, pipeline} from '@xenova/transformers';

type StateType = { [key: string]: Emotion };
type ConfigType = {
    // Optional. The alternate expression packs to use.
    selected?: {[key: string]: string} | null
};

type Emotion = "admiration" | "amusement" | "anger" | "annoyance" |
    "approval" | "caring" | "confusion" | "curiosity" | "desire" |
    "disappointment" | "disapproval" | "disgust" | "embarrassment" |
    "excitement" | "fear" | "gratitude" | "grief" | "joy" | "love" |
    "nervousness" | "optimism" | "pride" | "realization" | "relief" |
    "remorse" | "sadness" | "surprise" | "neutral";

// I know there's a way to do this without having the list of strings twice.
const EMOTIONS = new Set<string>(["admiration", "amusement", "anger", "annoyance",
    "approval", "caring", "confusion", "curiosity", "desire",
    "disappointment", "disapproval", "disgust", "embarrassment",
    "excitement", "fear", "gratitude", "grief", "joy", "love",
    "nervousness", "optimism", "pride", "realization", "relief",
    "remorse", "sadness", "surprise", "neutral"]);

type EmotionPack = {
    // The string here is a URL to an image file.
    [K in Emotion]?: string;
};

export class Expressions implements Extension<StateType, ConfigType> {

    charsToPacks: {[key: string]: EmotionPack}
    charsToEmotions: {[key: string]: Emotion}
    pipeline: any

    constructor(data: InitialData<StateType, ConfigType>) {
        const {
            characters,
            config,
            lastState
        } = data;
        this.charsToEmotions = {};
        this.charsToPacks = {};
        // This env setup is our own convention and not likely to be something
        // you'll want to do. We only host an extremely small subset of ONNX
        // HF models for things like this.
        env.allowRemoteModels = true;
        env.allowLocalModels = false;
        env.remoteHost = 'https://lfs.charhub.io/models/';

        // Very very ugly, but just loading up emotion packs and current state,
        // with a lot of ick from most fields being optional/possibly-undefined
        // instead of nice and clean.
        Object.keys(characters).forEach((charAnonId: string) => {
            if(!characters[charAnonId].isRemoved) {
                this.charsToEmotions[charAnonId] = lastState != null && lastState.hasOwnProperty(charAnonId) && EMOTIONS.has(lastState[charAnonId]) ? lastState[charAnonId] : 'neutral';
                this.charsToPacks[charAnonId] = characters[charAnonId].partial_extensions?.chub?.expressions?.expressions != null ?
                    characters[charAnonId].partial_extensions?.chub?.expressions?.expressions : {};
                if(config != null && config.selected?.hasOwnProperty(charAnonId)) {
                    this.charsToPacks[charAnonId] = characters[charAnonId].partial_extensions
                        .chub?.expressions?.alt_expressions?.hasOwnProperty(config.selected![charAnonId]) && characters[charAnonId].partial_extensions.chub.expressions.alt_expressions[config.selected![charAnonId]].expressions != null ?
                        characters[charAnonId].partial_extensions.chub.expressions.alt_expressions[charAnonId].expressions : this.charsToPacks[charAnonId];
                }
            }
        });
    }

    async load(): Promise<Partial<LoadResponse>> {
        // Note my complete and total disregard for error handling,
        // because the extension runner has it.
        this.pipeline = await pipeline("text-classification",
            "SamLowe/roberta-base-go_emotions");
        const testResult = await this.pipeline("I love you.");
        console.assert(testResult != null && testResult[0].label == 'love');
        return {
            success: true,
            error: null
        };
    }

    async setState(state: StateType): Promise<void> {
        if (state != null) {
            this.charsToEmotions = {...this.charsToEmotions, ...state};
        }
    }

    async beforePrompt(userMessage: Message): Promise<Partial<ExtensionResponse<StateType>>> {
        // Don't really care about this.
        return {
            extensionMessage: null,
            state: this.charsToEmotions,
            modifiedMessage: null,
            error: null
        };
    }

    async afterResponse(botMessage: Message): Promise<Partial<ExtensionResponse<StateType>>> {
        const newEmotion = await this.pipeline(botMessage.content);
        console.info(`New emotion for ${botMessage.anonymizedId}: ${newEmotion[0].label}`);
        this.charsToEmotions[botMessage.anonymizedId] = newEmotion[0].label;
        return {
            extensionMessage: null,
            state: this.charsToEmotions,
            modifiedMessage: null,
            error: null
        };
    }

    render(): ReactElement {
        return <div className="big-stacker"  style={{
            width: '100vw',
            height: '100vh',
            display: 'grid',
            alignItems: 'stretch'
            }}>
            {Object.keys(this.charsToEmotions).map(charId => {
                return this.charsToPacks[charId][this.charsToEmotions[charId]] != null && <img
                    key={`img-${charId}-${this.charsToEmotions[charId]}`}
                    style={{
                        width: '100%',
                        maxHeight: '100vh',
                        minHeight: '10px',
                        objectFit: 'contain'
                    }}
                     src={this.charsToPacks[charId][this.charsToEmotions[charId]]}
                     alt={''} />
            })}
        </div>;
    }

}
