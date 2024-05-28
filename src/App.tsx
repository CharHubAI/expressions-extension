import {ReactRunner} from "@chub-ai/stages-ts";
import {Expressions} from "./Expressions";
import {TestExtensionRunner} from "./TestRunner";

function App() {
  const isDev = import.meta.env.MODE === 'development';
  console.info(`Running in ${import.meta.env.MODE}`);

  return isDev ? <TestExtensionRunner factory={ (data: any) => new Expressions(data) }/> :
      <ReactRunner factory={(data: any) => new Expressions(data)} />;
}

export default App
