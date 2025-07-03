const endpoint = 'http://localhost:4000/uma/policies'
const client1 = 'https://pod.woutslabbinck.com/profile/card#me';
const client2 = 'https://pod.example.com/profile/card#me';


async function main() {
    console.log(`Primitive unit test to check policy access based on the client\n`);

    let response = await fetch(endpoint, { headers: { 'Authorization': client1 } })

    console.log("expecting usagePolicy1, usagePolicy2a and usagePolicy3", await response.text())

    response = await fetch(endpoint, { headers: { 'Authorization': client2 } })

    console.log("expecting usagePolicy1a and usagePolicy2", await response.text())
}
main()
