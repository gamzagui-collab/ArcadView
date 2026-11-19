type Group = { code: number; value: string | number };
type Scanner = { next(): Group; [key: string]: unknown };
type Attribute = Record<string, unknown> & { izcadMText?: Record<string, unknown> };
type Parser = { parseEntity(scanner: Scanner, current: Group): Attribute };
type Scene = {
  inserts: Map<unknown, Attribute>;
  _DecomposeAttribute(entity: Attribute, context: unknown): Iterable<unknown>;
  _DecomposeMText(entity: Attribute, context: unknown): Iterable<unknown>;
  _GetEntityLayer(entity: Attribute, context: unknown): string;
  _GetEntityColor(entity: Attribute, context: unknown): number;
};
const patched = new WeakSet<object>();

/** ATTRIB and its embedded MTEXT reuse group codes with different meanings. */
export function installAttributeTextCompatibility(parser: object, scene: object): void {
  if (patched.has(parser)) return;
  const p = (parser as { prototype: Parser }).prototype;
  const original = p.parseEntity;
  p.parseEntity = function(scanner, current) {
    const embedded: Group[] = [];
    const filtered = new Proxy(scanner, {
      get(target, key) {
        if (key === "next") return () => {
          let group = target.next();
          if ((group.code === 101 && group.value === "Embedded Object") ||
              (group.code === 100 && group.value === "AcDbMText")) {
            group = target.next();
            while (group.code !== 0 && group.code !== 1001) {
              embedded.push(group);
              group = target.next();
            }
          }
          return group;
        };
        const value = target[key as string];
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const entity = original.call(this, filtered, current);
    if (embedded.length) {
      // Keep the first MTEXT field. Some DWG exporters append duplicate context
      // fields (40/41/71) that must not overwrite nominal height/width/attachment.
      const first = (code: number) => embedded.find(g => g.code === code)?.value;
      const point = (code: number) => {
        const x = first(code), y = first(code + 10), z = first(code + 20);
        return typeof x === "number" && typeof y === "number" ? { x, y, z: z ?? 0 } : undefined;
      };
      let text = "";
      for (const group of embedded) {
        if (group.code === 1 || group.code === 3) text += String(group.value);
        if (group.code === 1) break;
      }
      if (text && typeof first(40) === "number" && Number(first(40)) > 0) {
        // The vendor font preflight reads ATTRIB.text. Include the complete
        // multiline value so a glyph present only in MTEXT loads its fallback.
        entity.text = text;
        entity.izcadMText = {
          type: "MTEXT", text, height: first(40), width: first(41),
          position: point(10) ?? entity.startPoint, direction: point(11),
          attachmentPoint: first(71), lineSpacing: first(44),
          styleName: first(7) ?? entity.textStyle,
        };
      }
    }
    return entity;
  };
  const s = (scene as { prototype: Scene }).prototype;
  const decompose = s._DecomposeAttribute;
  s._DecomposeAttribute = function*(entity, context) {
    if (!entity.izcadMText) { yield* decompose.call(this, entity, context); return; }
    const owner = this.inserts.get(entity.ownerHandle) ?? entity;
    yield* this._DecomposeMText({
      ...entity.izcadMText,
      layer: this._GetEntityLayer(owner, context),
      color: this._GetEntityColor(owner, context),
    }, context);
  };
  patched.add(parser);
}
