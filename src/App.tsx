import {ReactRunner} from "@chub-ai/stages-ts";
import {Expressions} from "./Expressions.tsx";
import {TestExtensionRunner} from "./TestRunner.tsx";

function App() {
  const isDev = import.meta.env.MODE === 'development';
  console.info(`Running in ${import.meta.env.MODE}`);

  return isDev ? <TestExtensionRunner factory={ (data: any) => new Expressions(data) }/> :
      <ReactRunner factory={(data: any) => new Expressions(data)} />;
}

export default App
