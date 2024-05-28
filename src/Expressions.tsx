import {ReactElement} from "react";
import {StageBase, StageResponse, InitialData, Message} from "@chub-ai/stages-ts";
import {LoadResponse} from "@chub-ai/stages-ts/dist/types/load";
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

export class Expressions extends StageBase<InitStateType, ChatStateType, MessageStateType, ConfigType> {

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
        this.pipeline = null;
        // This env setup is our own convention and not likely to be something
        // you'll want to do. We only host an extremely small subset of ONNX
        // HF models for things like this.
        env.allowRemoteModels = true;
        env.allowLocalModels = false;
        // This is fake and redirected within Cloudflare. If you need a model hosted/redirected
        // for this let me know.
        env.remoteHost = 'https://expressions-extension-768927333d4d.c5v4v4jx6pq5.win/';

        // Very very ugly, but just loading up emotion packs and current state,
        // with a lot of ick from most fields being optional/possibly-undefined
        // instead of nice and clean.
        Object.keys(characters).forEach((charAnonId: string) => {
            if(!characters[charAnonId].isRemoved) {
                this.charsToEmotions[charAnonId] = messageState != null && messageState.hasOwnProperty(charAnonId) && EMOTIONS.has(messageState[charAnonId]) ? messageState[charAnonId] : 'neutral';
                if (characters[charAnonId]?.partial_extensions?.chub?.expressions?.expressions != null) {
                    this.charsToPacks[charAnonId] = characters[charAnonId].partial_extensions?.chub?.expressions?.expressions;
                    this.hasPack = true;
                } else {
                    this.charsToPacks[charAnonId] = {};
                }
                if(config != null && config.selected != null
                    && config.selected?.hasOwnProperty(charAnonId)
                    && config.selected[charAnonId] != null
                    && config.selected[charAnonId] != ''
                    && config.selected[charAnonId].toLowerCase() != 'default'
                    && characters[charAnonId]?.partial_extensions.chub.alt_expressions != null
                && config.selected[charAnonId] in characters[charAnonId]?.partial_extensions.chub.alt_expressions) {
                    this.charsToPacks[charAnonId] = characters[charAnonId].partial_extensions
                        .chub.alt_expressions[config.selected![charAnonId]].expressions;
                }
            }
        });
    }

    async load(): Promise<Partial<LoadResponse<InitStateType, ChatStateType, MessageStateType>>> {
        try {
            this.pipeline = await pipeline("text-classification",
                "SamLowe/roberta-base-go_emotions");
        } catch (except: any) {
            console.error(`Error loading expressions pipeline, error: ${except}`);
            return { success: true, error: null }
        }
        try {
            if(import.meta.env.MODE === 'development') {
                const testResult = await this.pipeline("I love you.");
                console.assert(testResult != null && testResult[0].label == 'love');
            }
        } catch (except: any) {
            console.warn('import meta not supported.');
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

    async beforePrompt(userMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {
        // Don't really care about this.
        return {
            extensionMessage: null,
            stageDirections: null,
            messageState: this.charsToEmotions,
            modifiedMessage: null,
            error: null
        };
    }

    fallbackClassify(text: string): string {
        const lowered = text.toLowerCase();
        let result = 'neutral';
        Object.values(EmotionEnum).forEach(emotion => {
            if(lowered.includes(emotion.toLowerCase())) {
                result = emotion;
            }
        });
        return result;
    }

    async afterResponse(botMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {
        let newEmotion = 'neutral';
        if(this.pipeline != null) {
            try {
                newEmotion = (await this.pipeline(botMessage.content))[0].label;
            } catch (except: any) {
                console.warn(`Error classifying expression, error: ${except}`);
                newEmotion = this.fallbackClassify(botMessage.content);
            }
        } else {
            newEmotion = this.fallbackClassify(botMessage.content);
        }
        console.info(`New emotion for ${botMessage.anonymizedId}: ${newEmotion}`);
        this.charsToEmotions[botMessage.anonymizedId] = newEmotion;
        return {
            extensionMessage: null,
            stageDirections: null,
            messageState: this.charsToEmotions,
            modifiedMessage: null,
            error: null
        };
    }

    render(): ReactElement {
        return <div className="big-stacker"
                    key={'big-over-stacker'}
                    style={{
            width: '100vw',
            height: '100vh',
            display: 'grid',
            alignItems: 'stretch'
            }}>
            {Object.keys(this.charsToEmotions).map(charId => {
                if(this.charsToEmotions.hasOwnProperty(charId) && this.charsToEmotions[charId] != null &&
                    this.charsToPacks.hasOwnProperty(charId) && this.charsToPacks[charId] != null &&
                    this.charsToPacks[charId].hasOwnProperty(this.charsToEmotions[charId]) &&
                    this.charsToPacks[charId][this.charsToEmotions[charId]] != null
                ) {
                    return <img
                        key={`img-${charId}-${this.charsToEmotions[charId]}`}
                        style={{
                            width: '100%',
                            maxHeight: '100vh',
                            minHeight: '10px',
                            objectFit: 'contain'
                        }}
                        src={this.charsToPacks[charId][this.charsToEmotions[charId]]}
                        alt={''} />
                } else {
                    return <></>
                }
            })}
        </div>;
    }

}
