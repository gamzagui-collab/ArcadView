export function ArcadMark({className=""}:{className?:string}) {
  return <img className={`arcad-mark ${className}`} src="/arcad-mark.png" width={64} height={64} alt="" aria-hidden="true" draggable={false}/>;
}
export function Brand({company=false}:{company?:boolean}) {
 return <div className="arcad-brand"><ArcadMark/><div><strong>Arcad View</strong>{company?<small>GUI&apos;s Arc Industry</small>:null}</div></div>;
}

/** A lightweight architectural illustration, never a preview of a user's file. */
export function Blueprint({className=""}:{className?:string}) {
 return <svg className={`arcad-blueprint ${className}`} viewBox="0 0 600 350" fill="none" aria-hidden="true">
  <g stroke="currentColor" strokeWidth="1.1" opacity=".7"><path d="m160 310 200-100 170 70-202 103-168-73Zm0 0V115L360 24v186M160 115l168 70 202-94M328 185v198M530 280V91L360 24M185 299V129l152-70M210 308V140L365 69M235 318V151l155-70M260 328V162l155-70M285 338V173l155-70M310 348V184l155-70M351 371V179M377 358V167M403 345V155M429 332V143M455 319V131M481 306V119M507 293V107"/><path d="m160 148 168 70 202-94M160 181l168 70 202-94M160 214l168 70 202-94M160 247l168 70 202-94M160 280l168 70 202-94M360 24V4M85 323l245-122M120 345l245-122M480 50l70-33M122 95l43-20M360 24l170 67M346 8l198 80"/><path d="m70 240 65-32v-75l-65 32v75Zm0-75 65-32 29 12M70 203l65-32M80 160v75M94 153v75M108 146v75M122 139v75"/></g>
  <g stroke="currentColor" opacity=".3" strokeDasharray="4 5"><path d="M0 295 430 80M40 350 600 70M0 140l470 190M70 50l530 218"/></g>
 </svg>;
}
