import {
  BaseTypedRepresentationConverter,
  INTERNAL_QUADS,
  SOLID_META,
  type Representation,
  type RepresentationConverterArgs,
  transformSafely,
  BasicRepresentation,
} from '@solid/community-server'
import type { Quad } from '@rdfjs/types'
import { n3pack } from '../packaging/index'
import { Readable } from 'stream'


// import { packageContentQuads } from '../../packaging/index'

const outputPreference: Record<string, number> = { 'text/n3-package': 1, "text/turtle-package": .9 }
/**
 * Converts `internal/quads` to a packaged N3 format.
 */
export class QuadToPackageConverter extends BaseTypedRepresentationConverter {
  
  baseUrl: string;

  public constructor (baseUrl: string) {
    super(
      INTERNAL_QUADS,
      outputPreference
    )
    this.baseUrl = baseUrl;  
  }

  public async handle ({ identifier, representation: quads, preferences }: RepresentationConverterArgs):
  Promise<Representation> {

    // Can not be undefined if the `canHandle` call passed

    // Remove the ResponseMetadata graph as we never want to see it in a serialization
    // Note that this is a temporary solution as indicated in following comment:
    // https://github.com/CommunitySolidServer/CommunitySolidServer/pull/1188#discussion_r853830903
    quads.data = transformSafely<Quad>(quads.data, {
      objectMode: true,
      transform (quad: Quad): void {
        if (quad.graph.equals(SOLID_META.terms.ResponseMetadata)) {
          this.push(quad)//DataFactory.quad(quad.subject, quad.predicate, quad.object))
        } else {
          this.push(quad)
        }
      }
    })

    // Convert Steam<Quad> to Quad[]
    const dataQuads: Quad[] = await new Promise((resolve, reject) => {
      const streamQuads: Quad[] = []
      quads.data.on('data', q => { streamQuads.push(q as Quad) })
      quads.data.on('close', () => { resolve(streamQuads) })
    })
    

    let contentType = Object.keys(preferences.type || [])[0];
    console.log(contentType)
    
    const contentPackage = await n3pack.packageContent(dataQuads, {
      timeStamp: true,
      actor: this.baseUrl,
      origin: identifier.path
    })
    const contentString = await n3pack.serializePackage(contentPackage)

    console.log(`packaged: \n`, contentString, 'end')

    const data = new Readable()
    data.push(contentString.trim())
    data.push(null)
    

    switch (contentType) {
      case "text/n3-package":
        return new BasicRepresentation(data, quads.metadata, "text/n3-package")   
           
      default:
        throw new Error('Incorrect content type')
    }
  }
}
