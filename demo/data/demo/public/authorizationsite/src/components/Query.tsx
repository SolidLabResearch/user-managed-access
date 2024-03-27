import React from "react";
import { getDefaultSession } from '@inrupt/solid-client-authn-browser';
import { useState } from 'react';
import { QueryEngine } from '@comunica/query-sparql'
import type * as RDF from '@rdfjs/types';

import "../style/Query.css"

export default function Query() { 
  // Haal de nodige informatie uit het Solid session object.
  const session = getDefaultSession();
  const webId = session.info.webId;
  // Dit is de geauthenticeerde fetch functie uit het Solid session object.
  const fetch = session.fetch;

  // Houdt de resulterende bindings van de SPARQL opvraging bij.
  const [queryBindings, setQueryBindings] = useState<RDF.Bindings[]>([])

  // Houdt de URL van het opgevraagde bestand bij.
  const [fileURL, setFileURL] = useState(webId)

  // Afhandelen van de opvraging.
  async function handleSubmit(e: any) {
    e.preventDefault();

    const source = fileURL
    if (!source) return;
    try {
      // Zet de Comunica query engine op.
      const myEngine = new QueryEngine();

      // Voer de opvraging uit en verkrijg
      // de resulterende bindings als een array.
      const bindings = await (
        await myEngine.queryBindings(`
          SELECT * WHERE {
            ?s ?p ?o.
          } LIMIT 10`, {
          sources: [source],
          fetch: fetch,
        })
      ).toArray();
      
      // Sla het resultaat van de opvraging op.
      // De bindings in dit geval zijn voor de 
      // variabelen ?s, ?p en ?o.
      setQueryBindings(bindings)
    } catch (e) {
      console.error(e)
    } 
  }

  return (
    <div>
      <h1>Query</h1>
      <form onSubmit={handleSubmit}>
        <input type="text" value={fileURL} style={{ width: "50%" }}
          onChange={(e) => setFileURL(e.target.value)} />
        <input type="submit" value="Query resource" />
      </form>
      <br />
      <h2>
        Resulting bindings
      </h2>
      <table style={{ margin: "auto" }}>
        <thead>
          <tr>
            <td>?s</td>
            <td>?p</td>
            <td>?o</td>
          </tr>
        </thead>
        <tbody>
        {
          queryBindings.map((binding, index) => { 
            return(
              <tr key={index}>
                <td key="s">
                  {binding.get('s')?.value}
                </td>
                <td key="p">
                  {binding.get('p')?.value}
                </td>
                <td key="o">
                  {binding.get('o')?.value}
                </td>
              </tr>
            )
          })
        }
        </tbody>
      </table>
    </div>
  )
}
