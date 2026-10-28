/** A narrow deterministic guard, not a general scientific fact checker. */
export function inconsistentEqualComparison(text:string):boolean {
 const comparisons=/(\d+(?:\.\d+)?)\s*(km|cm|mm|m)\b[^.!?\n]{0,120}\b(?:finer|coarser|higher|lower|greater|smaller|larger|shorter|longer)\b[^.!?\n]{0,60}\bthan\b[^.!?\n]{0,100}?(\d+(?:\.\d+)?)\s*(km|cm|mm|m)\b/gi;
 const scale:Record<string,number>={km:1000,m:1,cm:.01,mm:.001};
 for(const match of text.matchAll(comparisons)){
  const a=Number(match[1])*scale[match[2].toLowerCase()],b=Number(match[3])*scale[match[4].toLowerCase()];
  if(Math.abs(a-b)<=Math.max(1e-12,Math.abs(a)*1e-12))return true;
 }
 return false;
}
