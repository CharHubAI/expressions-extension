import {Expressions} from "./Expressions.tsx";
import {useEffect, useState} from "react";
import {StageBase, InitialData} from "@chub-ai/stages-ts";
import InitData from './assets/test-init.json';

export interface TestExtensionRunnerProps<ExtensionType extends StageBase<InitStateType, ChatStateType, MessageStateType, ConfigType>, InitStateType, ChatStateType, MessageStateType, ConfigType> {
    factory: (data: InitialData<InitStateType, ChatStateType, MessageStateType, ConfigType>) => ExtensionType;
}

export const TestExtensionRunner = <ExtensionType extends StageBase<InitStateType, ChatStateType, MessageStateType, ConfigType>,
    InitStateType, ChatStateType, MessageStateType, ConfigType>({ factory }: TestExtensionRunnerProps<ExtensionType, InitStateType, ChatStateType, MessageStateType, ConfigType>) => {

    // @ts-ignore the linter doesn't like the idea of reading the imaginary Emotion type arbitrarily from strings
    const [extension, _setExtension] = useState(new Expressions(InitData));

    // This is what forces the node to re-render.
    const [node, setNode] = useState(new Date());

    useEffect(() => {
        extension.load().then((res) => {
            console.info(`Test StageBase Runner load success result was ${res.success}`);
            if(!res.success || res.error != null) {
                console.error(`Error from extension during load, error: ${res.error}`);
            }
            extension.afterResponse({
                identity: "",
                anonymizedId: "2", promptForId: null,
                content: "Checking what happens if sent messages for a bot without a pack.",
                isBot: true}).then(() => setNode(new Date()));
            extension.afterResponse({
                identity: "",
                anonymizedId: "1", promptForId: null,
                content: "I'm so confused. I don't understand. What? Why? How?",
                isBot: true
            }).then(() => setNode(new Date()));
            (new Promise(f => setTimeout(f, 5000))).then(() => {
                extension.setState({'1': 'embarrassment', '2': 'excitement', '3': 'love'}).then(() => setNode(new Date()));
            });
        });
    }, []);

    return <>
        <div key={'hidden-info'} style={{display: 'none'}}>{String(node)}{window.location.href}</div>
        {extension == null ? <div key={'loading-info'}>Stage loading...</div> : extension.render()}
    </>;
}
