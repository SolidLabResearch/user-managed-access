import {UserManagedAccessFetcher} from "./util/UMA-client";

const resource = "http://localhost:3000/alice/other/resource.txt"
const claim_token = "https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me"
const claim_token_format = 'urn:solidlab:uma:claims:formats:webid'
const fetcher = new UserManagedAccessFetcher({token:claim_token, token_format: claim_token_format});

async function main() {
    console.log(`Testing UMA flow using UMA Fetcher\n`)
    const response = await fetcher.fetch(resource, {
        method: "PUT",
        body: "some text"
    })

    console.log(`Creating document with RPT, expecting HTTP status in 200 range: ${response.status}\n`);

    const anonymousResponse = await fetch(resource)
    console.log(`Reading document without RPT, expecting HTTP status in 400 range: ${anonymousResponse.status}\n`);

    const readingResponse = await fetcher.fetch(resource)

    console.log(`Reading document with RPT, expecting the content written away: ${await readingResponse.text()}\n`);
}
main()
