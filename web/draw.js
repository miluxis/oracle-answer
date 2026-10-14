/* Editorial emotional associations, with full-library discovery for the prototype. */
const moodPools={
48:[26,14,33,45,59],47:[25,9,50,40,48],46:[4,32,14,51,63],45:[14,25,55,42,59],44:[28,35,55,13,21],43:[14,20,30,47,59],42:[1,34,13,43,47,64],49:[7,19,46,56,34,36],40:[24,39,18,31,57,3],39:[25,48,42,17,51],38:[8,25,35,51,50],3:[4,40,26,32,51],1:[39,24,18,3,57],41:[18,57,31,21,53],37:[5,11,25,17,42],14:[8,25,14,50,51],36:[5,42,17,60,4],2:[35,28,50,40,25],13:[40,4,50,25,63],35:[2,20,30,18,63],34:[16,27,32,45,55],4:[14,59,25,18,51],12:[25,14,38,51,59],33:[25,4,14,43,51],11:[26,33,21,52,56],32:[26,14,33,45,47],31:[6,37,49,61,62],30:[17,42,23,31,59],29:[25,38,9,28,51],10:[26,36,38,51,60],9:[35,34,28,1,42],8:[17,32,63,53,4],7:[31,17,42,32,59],6:[21,57,31,33,53],28:[26,14,38,47,12],25:[23,36,43,44,8],27:[32,4,26,51,55],5:[26,17,33,34,12],24:[26,59,14,47,20],23:[36,47,30,59,23],50:[25,35,38,39,48],22:[23,43,63,44,8],21:[26,49,61,17,50],20:[42,17,21,53,62],19:[18,32,3,45,41],18:[26,33,46,56,64],17:[26,14,45,33,18],16:[14,26,32,4,51],15:[38,56,52,35,59],51:[1,2,3,5,7,9,10,11,12,16,19,20,22,27,28,30,34,37,41,43,44,46,47,49,52,54,55,56,57,58,60,62,64]};

function drawSymbol(symbols,emotion,previous,random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296){
  // Confirmed founder example: tired -> rest. A single approved response may repeat.
  if(Number(emotion)===48 && symbols.some(s=>s.id===26))return 26;
  const eligible=symbols.filter(s=>s.id!==Number(previous));
  if(!eligible.length)throw new Error('No symbols available');
  const related=new Set(moodPools[emotion]||moodPools[51]);
  const matches=eligible.filter(s=>related.has(s.id));
  // 80% emotional associations + 20% discovery; every eligible symbol has positive weight.
  const weights=eligible.map(s=>matches.length?matches.length+(related.has(s.id)?4*eligible.length:0):1);
  const total=weights.reduce((a,b)=>a+b,0);let ticket=random()*total;
  for(let i=0;i<eligible.length;i++){ticket-=weights[i];if(ticket<0)return eligible[i].id;}
  return eligible.at(-1).id;
}
window.SYMBOL_DRAW={pick:drawSymbol,pools:moodPools};
