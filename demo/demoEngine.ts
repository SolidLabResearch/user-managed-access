import { ContainerUCRulesStorage, PolicyExecutor, UCRulesStorage, UconEnforcementDecision, UcpPatternEnforcement, UcpPlugin } from "@solidlab/ucp"
import { App, AppRunner, AppRunnerInput } from "@solid/community-server";
import * as Path from 'path';
import { EyeJsReasoner, readText } from "koreografeye";

type Demo = {
    css: App,
    ucpEngine: UconEnforcementDecision,
    storage: UCRulesStorage
}

export async function initEngine(portNumber = 3123): Promise<Demo> {
    const containerURL = `http://localhost:${portNumber}/`
    // code to start css server somewhere
    const css = await configSolidServer(portNumber)

    // initiating
    // load plugin(s) 
    const plugins = { "http://example.org/dataUsage": new UcpPlugin() }
    // Initialise koreografeye policy executor 
    const policyExecutor = new PolicyExecutor(plugins)
    // load N3 Rules from a directory 
    const rulesDirectory = Path.join(__dirname)
    const n3Rules: string[] = [readText(Path.join(rulesDirectory, 'purpose-time.n3'))!]
    // Initialise Usage Control Rule Storage 
    const uconRulesStorage = new ContainerUCRulesStorage(containerURL);
    const ucpEngine = new UcpPatternEnforcement(uconRulesStorage, n3Rules, new EyeJsReasoner([ 
        "--quiet", 
        "--nope", 
        "--pass"]), policyExecutor) 
    return {css, ucpEngine, storage: uconRulesStorage}
}


// utils
async function configSolidServer(port: number): Promise<App> {
    const input: AppRunnerInput = {
        config: Path.join(__dirname, "memory.json"),
        variableBindings: {
            'urn:solid-server:default:variable:port': port,
            'urn:solid-server:default:variable:baseUrl': `http://localhost:${port}/`,
            'urn:solid-server:default:variable:loggingLevel': 'warn',
        }
    }
    const cssRunner = await new AppRunner().create(input)
    return cssRunner
}

