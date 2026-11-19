declare module "dxf-viewer/src/DxfScene.js" {
  export class DxfScene {
    public layers: Map<string, { visible?: boolean }>;
    public blocks: Map<
      string,
      {
        flatten: boolean;
        offset: { x: number; y: number } | null;
      }
    >;
    public Build(dxf: object, fontFetchers: unknown): Promise<void>;
    public _BuildScene(): object;
    public _FilterEntity(entity: object): boolean;
    public _GetEntityLayer(entity: object): string;
    public _ProcessInsert(
      entity: object,
      blockContext?: unknown,
    ): void;
  }
}

declare module "dxf-viewer/src/parser/DxfParser.js" {
  export default class DxfParser {
    public parseSync(source: string): {
      entities: Array<{
        type?: string;
        xdata?: Record<
          string,
          {
            values?: Array<{
              code: number;
              value: unknown;
            }>;
          }
        >;
      }>;
    };
  }
}

declare module "dxf-viewer/src/TextRenderer.js" {
  export class TextRenderer {
    constructor(fontFetchers: Array<() => Promise<unknown>>);
    FetchFonts(text: string): Promise<boolean>;
    Render(options: {
      text: string; startPos: { x: number; y: number }; fontSize: number; color: number;
    }): Iterable<{ vertices: Array<{ x: number; y: number }> }>;
  }
}
declare module "dxf-viewer/src/parser/entities/attribute.js" {
  export default class AttributeParser {}
}
declare module "dxf-viewer/src/DxfWorker.js" {
  export class DxfWorker {}
}
declare module "dxf-viewer/src/DxfFetcher.js" {
  export class DxfFetcher { url: string; encoding: string; Fetch(progress?: (phase:string,received:number,total:number|null)=>void): Promise<any>; }
}
