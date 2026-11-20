/* Native bridge to the same GPL-3.0 LibreDWG 0.9.0 core used by the WASM path.
 * One decode, disk output, one disposable Android process; no MEMFS DXF copy. */
#include "config.h"
#include "dwg.h"
#include "dwg_api.h"
#include "bits.h"
#include "out_dxf.h"
#include <jni.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <inttypes.h>

static void quoted(FILE *f, const char *s) {
  const unsigned char *p = (const unsigned char *)(s ? s : "");
  fputc('"', f);
  for (; *p; p++) {
    if (*p == '"' || *p == '\\') { fputc('\\', f); fputc(*p, f); }
    else if (*p < 32) fprintf(f, "\\u%04x", *p);
    else fputc(*p, f);
  }
  fputc('"', f);
}
static char *text(const Dwg_Data *d, BITCODE_T value) {
  return value ? (d->header.version >= R_2007 ? bit_convert_TU((BITCODE_TU)value) : strdup(value)) : strdup("");
}
static Dwg_Object *resolve(Dwg_Data *d, BITCODE_H ref) {
  return ref ? dwg_resolve_handle_silent(d, ref->absolute_ref) : NULL;
}
static Dwg_Object *entry(Dwg_Data *d, Dwg_Object *obj, const char *name) {
  BITCODE_BL i;
  Dwg_Object_DICTIONARY *dict;
  if (!obj || obj->fixedtype != DWG_TYPE_DICTIONARY) return NULL;
  dict = obj->tio.object->tio.DICTIONARY;
  for (i = 0; i < dict->numitems; i++) {
    char *key = text(d, dict->texts[i]);
    int match = key && strcmp(key, name) == 0;
    free(key);
    if (match) return resolve(d, dict->itemhandles[i]);
  }
  return NULL;
}
static int finite_array(const double *a, int count) {
  int i;
  if (!a) return 0;
  for (i = 0; i < count; i++) if (!isfinite(a[i])) return 0;
  return 1;
}
static void array(FILE *f, const double *a, int count) {
  int i; fputc('[', f);
  for (i = 0; i < count; i++) fprintf(f, "%s%.17g", i ? "," : "", a[i]);
  fputc(']', f);
}
static int metadata(const char *path, Dwg_Data *d) {
  FILE *f = fopen(path, "wb");
  BITCODE_BL i;
  int first = 1, first_clip = 1;
  Dwg_Object_VPORT *saved = NULL, *active = NULL;
  if (!f) return DWG_ERR_IOERROR;
  fputs("{\"version\":1,\"layers\":[", f);
  for (i = 0; i < d->num_objects; i++) {
    Dwg_Object *o = &d->object[i];
    if (o->fixedtype == DWG_TYPE_LAYER) {
      Dwg_Object_LAYER *layer = o->tio.object->tio.LAYER;
      char *name = text(d, layer->name);
      fprintf(f, "%s{\"name\":", first ? "" : ","); first = 0; quoted(f, name); free(name);
      fprintf(f, ",\"off\":%s,\"frozen\":%s,\"frozenInNewViewport\":%s}", layer->off ? "true" : "false", layer->frozen ? "true" : "false", layer->frozen_in_new ? "true" : "false");
    } else if (o->fixedtype == DWG_TYPE_VPORT) {
      Dwg_Object_VPORT *v = o->tio.object->tio.VPORT;
      if (isfinite(v->VIEWCTR.x) && isfinite(v->VIEWCTR.y) && isfinite(v->VIEWSIZE) && v->VIEWSIZE > 0) {
        char *name = text(d, v->name);
        if (!saved) saved = v;
        if ((name && strcasecmp(name, "*active") == 0) || (v->lower_left.x == 0 && v->lower_left.y == 0 && v->upper_right.x == 1 && v->upper_right.y == 1)) active = v;
        free(name);
      }
    }
  }
  fputs("],\"clips\":{", f);
  for (i = 0; i < d->num_objects; i++) {
    Dwg_Object *o = &d->object[i], *filter;
    Dwg_Object_SPATIAL_FILTER *s;
    unsigned j;
    if (o->fixedtype != DWG_TYPE_INSERT && o->fixedtype != DWG_TYPE_MINSERT) continue;
    filter = entry(d, entry(d, resolve(d, o->tio.entity->xdicobjhandle), "ACAD_FILTER"), "SPATIAL");
    if (!filter || filter->fixedtype != DWG_TYPE_SPATIAL_FILTER) continue;
    s = filter->tio.object->tio.SPATIAL_FILTER;
    if (s->num_clip_verts < 2 || !s->clip_verts || !finite_array(s->inverse_transform, 12) || !finite_array(s->transform, 12)) continue;
    for (j = 0; j < s->num_clip_verts; j++) if (!isfinite(s->clip_verts[j].x) || !isfinite(s->clip_verts[j].y)) break;
    if (j != s->num_clip_verts) continue;
    fprintf(f, "%s\"%" PRIX64 "\":{\"enabled\":%s,\"points\":[", first_clip ? "" : ",", (uint64_t)o->handle.value, s->display_boundary_on ? "true" : "false"); first_clip = 0;
    for (j = 0; j < s->num_clip_verts; j++) fprintf(f, "%s{\"x\":%.17g,\"y\":%.17g}", j ? "," : "", s->clip_verts[j].x, s->clip_verts[j].y);
    fputs("],\"inverseTransform\":", f); array(f, s->inverse_transform, 12); fputs(",\"transform\":", f); array(f, s->transform, 12); fputc('}', f);
  }
  fputs("},\"savedView\":", f);
  saved = active ? active : saved;
  if (saved) fprintf(f, "{\"center\":{\"x\":%.17g,\"y\":%.17g},\"viewHeight\":%.17g,\"aspectRatio\":%.17g,\"twistAngle\":%.17g}", saved->VIEWCTR.x, saved->VIEWCTR.y, saved->VIEWSIZE, isfinite(saved->aspect_ratio) ? saved->aspect_ratio : 1, isfinite(saved->VIEWTWIST) ? saved->VIEWTWIST : 0);
  else fputs("null", f);
  fputc('}', f);
  return fclose(f) == 0 ? 0 : DWG_ERR_IOERROR;
}
static int convert(const char *input, const char *output, const char *meta) {
  Dwg_Data d = {0}; Bit_Chain out = {0};
  int result = dwg_read_file(input, &d);
  if (result >= DWG_ERR_CRITICAL) { dwg_free(&d); return result; }
  result = metadata(meta, &d);
  if (result) { dwg_free(&d); return result; }
  out.version = d.header.version; out.from_version = d.header.from_version;
  out.fh = fopen(output, "wb");
  if (!out.fh) { dwg_free(&d); return DWG_ERR_IOERROR; }
  result = dwg_write_dxf(&out, &d);
  if (fclose(out.fh) != 0 && !result) result = DWG_ERR_IOERROR;
  dwg_free(&d); return result;
}
JNIEXPORT jint JNICALL Java_com_izcad_viewer_NativeDwg_convertFiles(JNIEnv *env, jclass clazz, jstring input, jstring output, jstring meta) {
  const char *a = (*env)->GetStringUTFChars(env, input, NULL), *b = (*env)->GetStringUTFChars(env, output, NULL), *c = (*env)->GetStringUTFChars(env, meta, NULL);
  int result;
  (void)clazz;
  if (!a || !b || !c) result = DWG_ERR_OUTOFMEM;
  else result = convert(a, b, c);
  if (a) (*env)->ReleaseStringUTFChars(env, input, a);
  if (b) (*env)->ReleaseStringUTFChars(env, output, b);
  if (c) (*env)->ReleaseStringUTFChars(env, meta, c);
  return result;
}
