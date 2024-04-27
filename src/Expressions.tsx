import {ReactElement} from "react";
import {Extension, ExtensionResponse, InitialData, Message} from "chub-extensions-ts";
import {LoadResponse} from "chub-extensions-ts/dist/types/load";
import {env, pipeline} from '@xenova/transformers';

type MessageStateType = { [key: string]: Emotion };
type ConfigType = {
    // Optional. The alternate expression packs to use.
    selected?: {[key: string]: string} | null
};

enum EmotionEnum {
    admiration = 'admiration',
    amusement = 'amusement',
    anger = 'anger',
    annoyance = 'annoyance',
    approval = 'approval',
    caring = 'caring',
    confusion = 'confusion',
    curiosity = 'curiosity',
    desire = 'desire',
    disappointment = 'disappointment',
    disapproval = 'disapproval',
    disgust = 'disgust',
    embarrassment = 'embarrassment',
    excitement = 'excitement',
    fear = 'fear',
    gratitude = 'gratitude',
    grief = 'grief',
    joy = 'joy',
    love = 'love',
    nervousness = 'nervousness',
    optimism = 'optimism',
    pride = 'pride',
    realization = 'realization',
    relief = 'relief',
    remorse = 'remorse',
    sadness = 'sadness',
    surprise = 'surprise',
    neutral = 'neutral',
}

type Emotion = {
    [key in keyof typeof EmotionEnum]: string;
}[keyof typeof EmotionEnum];

const EMOTIONS = new Set<string>(Object.values(EmotionEnum));

type EmotionPack = {
    // The string here is a URL to an image file.
    [K in Emotion]?: string;
};

type InitStateType = null;

type ChatStateType = null;

export class Expressions extends Extension<InitStateType, ChatStateType, MessageStateType, ConfigType> {

    charsToPacks: {[key: string]: EmotionPack}
    charsToEmotions: {[key: string]: Emotion}
    pipeline: any
    hasPack: boolean

    constructor(data: InitialData<InitStateType, ChatStateType, MessageStateType, ConfigType>) {
        super(data);
        const {
            characters,
            config,
            messageState
        } = data;
        this.charsToEmotions = {};
        this.charsToPacks = {};
        this.hasPack = false;
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
                this.charsToEmotions[charAnonId] = messageState != null && messageState.hasOwnProperty(charAnonId) && EMOTIONS.has(messageState[charAnonId]) ? messageState[charAnonId] : 'neutral';
                if (characters[charAnonId].partial_extensions?.chub?.expressions?.expressions != null) {
                    this.charsToPacks = characters[charAnonId].partial_extensions?.chub?.expressions?.expressions;
                    this.hasPack = true;
                } else {
                    this.charsToPacks[charAnonId] = {};
                }
                if(config != null && config.selected?.hasOwnProperty(charAnonId)) {
                    this.charsToPacks[charAnonId] = characters[charAnonId].partial_extensions
                        .chub?.expressions?.alt_expressions?.hasOwnProperty(config.selected![charAnonId]) && characters[charAnonId].partial_extensions.chub.expressions.alt_expressions[config.selected![charAnonId]].expressions != null ?
                        characters[charAnonId].partial_extensions.chub.expressions.alt_expressions[charAnonId].expressions : this.charsToPacks[charAnonId];
                }
            }
        });
    }

    async load(): Promise<Partial<LoadResponse<InitStateType, ChatStateType, MessageStateType>>> {
        // Note my complete and total disregard for error handling,
        // because the extension runner has it.
        this.pipeline = await pipeline("text-classification",
            "SamLowe/roberta-base-go_emotions");
        if(import.meta.env.MODE === 'development') {
            const testResult = await this.pipeline("I love you.");
            console.assert(testResult != null && testResult[0].label == 'love');
        }
        return {
            success: this.hasPack,
            error: null
        };
    }

    async setState(state: MessageStateType): Promise<void> {
        if (state != null) {
            this.charsToEmotions = {...this.charsToEmotions, ...state};
        }
    }

    async beforePrompt(userMessage: Message): Promise<Partial<ExtensionResponse<ChatStateType, MessageStateType>>> {
        // Don't really care about this.
        return {
            extensionMessage: null,
            messageState: this.charsToEmotions,
            modifiedMessage: null,
            error: null
        };
    }

    async afterResponse(botMessage: Message): Promise<Partial<ExtensionResponse<ChatStateType, MessageStateType>>> {
        const newEmotion = await this.pipeline(botMessage.content);
        console.info(`New emotion for ${botMessage.anonymizedId}: ${newEmotion[0].label}`);
        this.charsToEmotions[botMessage.anonymizedId] = newEmotion[0].label;
        return {
            extensionMessage: null,
            messageState: this.charsToEmotions,
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
