import { readFileSync } from "fs";
import { EyeJsReasoner } from "koreografeye";
import { Store, Parser, Writer } from "n3";
import path from "path";

const parser = new Parser();
const rules = new Array<string>();
const facts = new Store();

facts.addQuads(parser.parse(readFileSync(path.join(__dirname, 'context.ttl')).toString()))
facts.addQuads(parser.parse(readFileSync(path.join(__dirname, 'policy1.ttl')).toString()))
// facts.addQuads(parser.parse(readFileSync(path.join(__dirname, 'policy2.ttl')).toString()))
// facts.addQuads(parser.parse(readFileSync(path.join(__dirname, 'policy3.ttl')).toString()))

rules.push(readFileSync(path.join(__dirname, 'rules_purpose.n3')).toString());
rules.push(readFileSync(path.join(__dirname, 'rules_crud.n3')).toString());

(async () => {
  
  console.log('>>>>> BEFORE');
  const reasoner1 = new EyeJsReasoner(["--quiet", "--nope", "--pass"]);
  await reasoner1.reason(facts, rules);
  console.log('>>>>> BETWEEN');
  const reasoner2 = new EyeJsReasoner(["--quiet", "--nope", "--pass"]);
  await reasoner2.reason(facts, rules);
  console.log('>>>>> AFTER');

})();
