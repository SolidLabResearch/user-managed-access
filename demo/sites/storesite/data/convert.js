const { readFileSync, writeFile, writeFileSync } = require("fs");

let content = readFileSync('./zeus.json', {encoding: 'utf-8'})
let jsoncontent = JSON.parse(content)

let beveragesContent = []

for (let item of jsoncontent) {
    if (item.category === "beverages") beveragesContent.push(item)
}

writeFileSync('./zeusbeverages.json', JSON.stringify(beveragesContent, null, 2))