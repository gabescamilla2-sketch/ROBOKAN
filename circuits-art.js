// Original vector artwork. Pin coordinates are shared by the drawing and editor.
const range = (count, draw) => Array.from({ length: count }, (_, index) => draw(index)).join('');
const text = (x, y, value, size = 6, extra = '') => `<text x="${x}" y="${y}" fill="#E2F3EE" font-family="monospace" font-size="${size}" ${extra}>${value}</text>`;
const hole = (x, y, radius = 7) => `<circle cx="${x}" cy="${y}" r="${radius + 2}" fill="#B3C5C0"/><circle cx="${x}" cy="${y}" r="${radius}" fill="#F3F6FB"/><circle cx="${x}" cy="${y}" r="${radius + 2}" fill="none" stroke="#568B8E" stroke-width=".8"/>`;
const socket = (x, y) => `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" rx=".7" fill="#151E24" stroke="#536368" stroke-width="1.2"/><path d="m${x - 3} ${y - 3} 6 0-1.5 1.5h-3z" fill="#3A4449"/><rect x="${x - 1.5}" y="${y - 1.5}" width="3" height="3" fill="#080F13"/>`;
const chip = (x, y, width, height, pins = 12) => `<g>${range(pins, i => `<path d="M${x + 5 + i * (width - 10) / (pins - 1)} ${y - 4}v${height + 8}" stroke="#B7C0C3" stroke-width="3"/>`)}<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="2" fill="#252C32" stroke="#121A20"/><path d="M${x + 2} ${y + 2}h${width - 4}" stroke="#414950"/><circle cx="${x + 5}" cy="${y + height - 5}" r="1.5" fill="#555E65"/></g>`;
const smd = (x, y, horizontal = false) => `<g transform="translate(${x} ${y})${horizontal ? ' rotate(90)' : ''}"><rect x="-2" y="-5" width="4" height="10" rx=".5" fill="#C5CCB4"/><path d="M-2-3h4v6h-4z" fill="#606F69"/></g>`;

function uno(prefix) {
  return `<defs><linearGradient id="${prefix}-metal" x2="0" y2="1"><stop stop-color="#D1D7DC"/><stop offset=".45" stop-color="#F0F2F3"/><stop offset=".5" stop-color="#A8B0B8"/><stop offset="1" stop-color="#BCC4CD"/></linearGradient></defs>
    <path d="M29 1H315L339 25V221L318 244H29Q18 244 18 233V12Q18 1 29 1" fill="#087D91" stroke="#05677B" stroke-width="1.5"/>
    <path d="M23 39V13q0-7 7-7h282l21 21v191" fill="none" stroke="#2294A3" stroke-width="1"/>
    <g fill="none" stroke="#38A4AA" stroke-width=".7" opacity=".48"><path d="M115 35v29l29 29h105l25 25v68M138 30v30l31 31h113v62M197 181v-44l-24-24H96l-22-22V71M238 216v-27l19-19h35v-55M114 210v-34l-32-32V110M156 35v23l25 25h98M168 38v15l19 19h104"/><path d="M144 224v-20l-21-21V123M132 224v-17l-22-22v-58M286 39v31l15 15v82"/></g>
    ${hole(32, 16)}${hole(324, 51)}${hole(324, 222)}${hole(86, 230)}
    <rect x="1" y="54" width="69" height="54" rx="2" fill="url(#${prefix}-metal)" stroke="#9EA8B1" stroke-width="1.5"/><path d="M2 57h12v48H2M65 59h5v45h-5" fill="#A2ABB4"/><path d="M14 54v54M1 62h12M1 100h12" stroke="#E0E5E9" stroke-width="1.5"/>
    <rect x="10" y="188" width="59" height="38" rx="2" fill="#24292D" stroke="#111A1E" stroke-width="2"/><path d="M10 192h18q32 0 32 15t-32 15H10" fill="#1A2026"/><rect x="7" y="187" width="9" height="41" fill="#11191E"/><path d="M20 188h47v5H20" fill="#43494C"/>
    <rect x="40" y="13" width="27" height="26" rx="2" fill="#CED2D2" stroke="#A6B5B6"/><rect x="45" y="17" width="18" height="18" rx="9" fill="#B34D48"/><path d="M38 17h-4m4 17h-4m33-17h4m-4 17h4" stroke="#C7D4C8" stroke-width="3"/>
    ${text(38, 49, 'RESET', 6)}
    <rect x="111" y="7" width="117" height="15" fill="#222B30" rx="1"/>${range(8, i => socket(119 + i * 14, 14))}
    <rect x="242" y="7" width="84" height="15" fill="#222B30" rx="1"/>${range(6, i => socket(249 + i * 14, 14))}
    ${range(8, i => text(121 + i * 14, 28, ['AREF', 'GND', '13', '12', '~11', '~10', '~9', '8'][i], 5, 'transform="rotate(90 ' + (121 + i * 14) + ' 28)"'))}
    ${range(6, i => text(251 + i * 14, 28, ['7', '~6', '~5', '4', '~3', '2'][i], 5, 'transform="rotate(90 ' + (251 + i * 14) + ' 28)"'))}
    <path d="M117 53h200" stroke="#D7F4E9" stroke-width="1"/>${text(164, 50, 'DIGITAL (PWM ~)', 6)}
    <g fill="none" stroke="#EBFAF5" stroke-width="3.5"><path d="M192 78c-15-25-37-21-37-4 0 18 23 22 37-4 14-25 37-21 37-4 0 18-23 22-37-4"/><path d="M163 74h10m37-5v10m-5-5h10"/></g>
    ${text(150, 107, 'UNO', 16, 'letter-spacing="3"')}${text(151, 118, 'MICROCONTROLLER BOARD', 4.7)}
    ${chip(89, 77, 32, 30, 7)}${text(93, 94, '16U2', 5)}
    <rect x="78" y="43" width="12" height="22" rx="5" fill="#BAC1BB" stroke="#81958F"/>
    <rect x="157" y="146" width="150" height="26" rx="2" fill="#162329" stroke="#32464B" stroke-width="3"/>${chip(159, 143, 146, 30, 14)}${text(182, 161, 'ATMEGA328P · PU', 8, 'fill="#A6ADA7"')}
    ${range(3, i => `<rect x="73" y="${124 + i * 10}" width="11" height="5" fill="#C1CEC4"/><rect x="76" y="${124 + i * 10}" width="5" height="5" fill="${i === 0 ? '#FFDB76' : '#A5C7B5'}"/>`)}${text(57, 129, 'L', 6)}${text(55, 139, 'TX', 5)}${text(55, 149, 'RX', 5)}
    <rect x="287" y="86" width="13" height="6" fill="#D0D8C6"/><rect x="291" y="86" width="5" height="6" fill="#B5E385"/>${text(303, 91, 'ON', 5)}
    <g>${range(2, i => `<circle cx="${89 + i * 35}" cy="199" r="14" fill="#202B30"/><circle cx="${89 + i * 35}" cy="197" r="12" fill="#C5CECE" stroke="#8F9D9F"/><path d="M${79 + i * 35} 197h20m-10-10v20" stroke="#E6ECE8"/>`)}</g>
    ${chip(38, 150, 13, 23, 3)}${smd(60, 160)}${smd(139, 189)}${smd(146, 189)}${smd(115, 133, true)}${smd(115, 126, true)}
    ${range(3, i => `<rect x="${83 + i * 10}" y="40" width="7" height="17" fill="#3B4D4B"/>${range(2, j => `<rect x="${85 + i * 10}" y="${43 + j * 8}" width="3" height="3" fill="#B8B282"/>`)}`)}${text(84, 65, 'ICSP', 5)}
    <rect x="129" y="222" width="112" height="15" fill="#222B30" rx="1"/>${range(8, i => socket(136 + i * 14, 230))}
    ${range(8, i => text(138 + i * 14, 216, ['IOREF', 'RESET', '3V3', '5V', 'GND', 'GND', 'VIN', 'NC'][i], 5, 'transform="rotate(-90 ' + (138 + i * 14) + ' 216)"'))}
    <rect x="254" y="222" width="72" height="15" fill="#222B30" rx="1"/>${range(6, i => socket(260 + i * 12, 230))}${range(6, i => text(258 + i * 12, 216, `A${i}`, 5))}
    <path d="M133 185h102m21 13h61" stroke="#D7F4E9" stroke-width="1"/>${text(163, 183, 'POWER', 5.5)}${text(263, 195, 'ANALOG IN', 5.5)}`;
}

function ultrasonic(prefix) {
  return `<defs><radialGradient id="${prefix}-rim"><stop offset=".65" stop-color="#8F9BA2"/><stop offset=".71" stop-color="#F9FAFA"/><stop offset=".85" stop-color="#DDE2E4"/><stop offset="1" stop-color="#7F929E"/></radialGradient><pattern id="${prefix}-mesh" width="2.4" height="2.4" patternUnits="userSpaceOnUse"><rect width="2.4" height="2.4" fill="#515C63"/><path d="M0 0h2.4v2.4" fill="none" stroke="#798186" stroke-width=".4"/></pattern></defs>
    <path d="M6 3h213v96H6z" fill="#215F98" stroke="#174D7F" stroke-width="1.5"/><path d="M8 5h209v91" fill="none" stroke="#417FB2" stroke-width=".6"/>
    ${hole(13, 11, 3)}${hole(211, 11, 3)}${hole(13, 91, 3)}${hole(211, 91, 3)}
    ${[58, 167].map(x => `<circle cx="${x}" cy="52" r="39" fill="#163D60" opacity=".4" transform="translate(0 2)"/><circle cx="${x}" cy="51" r="38" fill="url(#${prefix}-rim)"/><circle cx="${x}" cy="51" r="30.5" fill="#172229"/><circle cx="${x}" cy="51" r="26" fill="url(#${prefix}-mesh)"/><circle cx="${x}" cy="51" r="17" fill="#1B242A" opacity=".35"/>`).join('')}
    <rect x="91" y="7" width="43" height="15" rx="7" fill="#ADB8C1" stroke="#7B8C9A"/>${text(89, 35, 'HC-SR04', 8)}
    ${range(4, i => `<rect x="${85 + i * 18}" y="98" width="4" height="23" fill="#B6BDC1"/><rect x="${85 + i * 18}" y="119" width="4" height="8" fill="#D9B977"/><rect x="${83 + i * 18}" y="91" width="8" height="7" rx="1" fill="#A6BEAC"/>${text(89 + i * 18, 87, ['VCC', 'TRIG', 'ECHO', 'GND'][i], 5, `transform="rotate(-90 ${89 + i * 18} 87)"`)}`)}`;
}

function breadboard() {
  return `<rect x="0" y="0" width="300" height="186" rx="9" fill="#E6EBF0" stroke="#C8D1DD"/><rect x="4" y="2" width="292" height="179" rx="7" fill="#FCFDFE" stroke="#E0E5EC"/><rect x="8" y="87" width="284" height="11" rx="3" fill="#E4E9EF"/><path d="M10 91h280" stroke="#D0D8E2"/>
    <path d="M19 13h261M19 165h261" stroke="#E8878F" stroke-width="1"/><path d="M19 28h261M19 180h261" stroke="#6EA4D8" stroke-width="1"/>
    ${range(24, col => range(14, row => { const y = row < 2 ? 19 + row * 5 : row < 7 ? 43 + (row - 2) * 9 : row < 12 ? 112 + (row - 7) * 9 : 170 + (row - 12) * 5; return `<rect x="${21 + col * 11}" y="${y}" width="3.3" height="3.3" rx=".7" fill="#596C81"/><path d="M${21 + col * 11} ${y}h3.3" stroke="#B7C2CF" stroke-width=".7"/>`; }))}
    ${range(5, i => `<text x="10" y="${47 + i * 9}" font-size="4" fill="#A2ADBB" font-family="monospace">${'abcde'[i]}</text><text x="10" y="${116 + i * 9}" font-size="4" fill="#A2ADBB" font-family="monospace">${'fghij'[i]}</text>`)}
    ${range(6, i => `<text x="${22 + i * 44}" y="38" fill="#9AA6B7" font-size="4" font-family="monospace">${i * 4 + 1}</text><text x="${22 + i * 44}" y="161" fill="#9AA6B7" font-size="4" font-family="monospace">${i * 4 + 1}</text>`)}
    <g font-family="monospace" font-size="6"><text x="9" y="22" fill="#E8878F">+</text><text x="9" y="29" fill="#6EA4D8">−</text><text x="9" y="174" fill="#E8878F">+</text><text x="9" y="181" fill="#6EA4D8">−</text></g>`;
}

function led(prefix) {
  return `<defs><linearGradient id="${prefix}-led"><stop stop-color="#D33E53"/><stop offset=".45" stop-color="#FF8D96"/><stop offset="1" stop-color="#DB4056"/></linearGradient></defs><path d="M34 58v47m22-47v35" stroke="#A8B5C2" stroke-width="3"/><path d="M26 56V31a19 19 0 0 1 38 0v25" fill="url(#${prefix}-led)" stroke="#B63C51"/><rect x="22" y="55" width="46" height="7" rx="2" fill="#F07683" stroke="#D85366"/><path d="M33 43V31q0-11 8-13" fill="none" stroke="#FFD9DA" stroke-width="4" opacity=".7"/><path d="M37 52V41h15v11" stroke="#992E45" stroke-width="2" opacity=".5"/>`;
}

function resistor() {
  return `<path d="M0 25h32m85 0h33" stroke="#A9B6C3" stroke-width="3"/><path d="M31 16q0-6 8-6h9l8 4h38l8-4h9q8 0 8 6v18q0 6-8 6h-9l-8-4H56l-8 4h-9q-8 0-8-6z" fill="#DEC79B" stroke="#B79B70"/><path d="M47 12v26" stroke="#B64B3C" stroke-width="7"/><path d="M63 14v22" stroke="#B64B3C" stroke-width="7"/><path d="M80 14v22" stroke="#76523B" stroke-width="7"/><path d="M105 11v28" stroke="#B29A51" stroke-width="4"/><path d="M34 17h10m43 0h11" stroke="#F8EBD2" stroke-width="2" opacity=".6"/>`;
}

function servo() {
  return `<path d="M17 65C0 70 12 102 0 112" stroke="#785342" stroke-width="3" fill="none"/><path d="M21 65C4 70 16 102 4 112" stroke="#CF4F4E" stroke-width="3" fill="none"/><path d="M25 65C8 70 20 102 8 112" stroke="#DDA85A" stroke-width="3" fill="none"/><rect x="20" y="27" width="62" height="65" rx="3" fill="#2E65A5" stroke="#1C528D"/><rect x="14" y="39" width="74" height="8" rx="2" fill="#497BB5"/><rect x="23" y="52" width="56" height="34" rx="1" fill="#3271B3"/><path d="M29 32h44M25 50v32" stroke="#8AB1D4" stroke-width="1.5"/><circle cx="52" cy="30" r="17" fill="#477DB7"/><circle cx="52" cy="25" r="9" fill="#D9E0DF"/><path d="M26 19h52q5 0 5 5t-5 5H26q-5 0-5-5t5-5" fill="#F2F3ED" stroke="#B9C7CD"/><circle cx="52" cy="24" r="3" fill="#95A2AA"/><circle cx="28" cy="24" r="1.6" fill="#97A7B6"/><circle cx="76" cy="24" r="1.6" fill="#97A7B6"/><text x="29" y="67" font-family="monospace" font-size="6" fill="#DFEAF7">MICRO SERVO</text><text x="40" y="77" font-family="monospace" font-size="7" fill="#DFEAF7">9g</text>`;
}

const genericArt = (title, color = "#2878F0") => () =>
  `<rect x="8" y="8" width="144" height="86" rx="10" fill="${color}" stroke="#17243B" stroke-width="2"/><rect x="15" y="15" width="130" height="72" rx="7" fill="#FFFFFF" opacity=".12"/><text x="80" y="48" text-anchor="middle" fill="#FFFFFF" font-family="monospace" font-size="10">${title}</text>`;
const pinsAt = (names, width, y) => names.map((name, i) => ({
  name, x: 14 + i * (width - 28) / Math.max(1, names.length - 1), y,
}));
const sensorArt = (title) => () =>
  `<rect x="8" y="8" width="164" height="90" rx="8" fill="#23877A" stroke="#174D7F" stroke-width="2"/><circle cx="45" cy="43" r="17" fill="#DDE7EA" stroke="#6A7F8B"/><circle cx="45" cy="43" r="9" fill="#324660"/><rect x="79" y="29" width="74" height="29" rx="4" fill="#F3F6FB"/><text x="116" y="47" text-anchor="middle" fill="#17243B" font-family="monospace" font-size="7">${title}</text><path d="M28 98v18m30-18v18m30-18v18m30-18v18" stroke="#A9B6C3" stroke-width="3"/>`;

export const componentTypes = {
  motor: { name: 'Motor DC', model: 'Motor educativo', category: 'outputs', width: 125, height: 100,
    art: () => '<rect x="18" y="15" width="82" height="60" rx="15" fill="#BAC6D5" stroke="#52627A" stroke-width="2"/><circle cx="59" cy="45" r="22" fill="#17243B"/><circle cx="59" cy="45" r="9" fill="#FFB84D"/><path d="M100 45h22M30 75v22M85 75v22" stroke="#52627A" stroke-width="5"/>',
    pins: [{ name: 'MOTOR_POSITIVE', x: 30, y: 97 }, { name: 'MOTOR_NEGATIVE', x: 85, y: 97 }] },
  buzzer: { name: 'Buzzer', model: 'Buzzer educativo', category: 'outputs', width: 95, height: 100,
    art: () => '<ellipse cx="47" cy="42" rx="34" ry="32" fill="#17243B" stroke="#52627A" stroke-width="2"/><ellipse cx="47" cy="36" rx="27" ry="23" fill="#324660"/><circle cx="47" cy="36" r="7" fill="#101A2B"/><path d="M30 70v27M65 70v27" stroke="#BAC6D5" stroke-width="4"/><text x="28" y="87" fill="#F16C75" font-size="14">+</text>',
    pins: [{ name: 'POSITIVE', x: 30, y: 97 }, { name: 'NEGATIVE', x: 65, y: 97 }] },
  uno: { name: 'Arduino Uno', model: 'ATmega328P', category: 'boards', width:340, height:245, art:uno, pins:[...Array.from({length:8}, (_,i)=>({name:['AREF','GND','D13','D12','D11','D10','D9','D8'][i],x:119+i*14,y:14})),...Array.from({length:6},(_,i)=>({name:`D${7-i}`,x:249+i*14,y:14})),...Array.from({length:8},(_,i)=>({name:['IOREF','RESET','3V3','5V','GND1','GND2','VIN','NC'][i],x:136+i*14,y:230})),...Array.from({length:6},(_,i)=>({name:`A${i}`,x:260+i*12,y:230}))] },
  pi: { name:'Raspberry Pi',model:'GPIO 3.3 V',category:'boards',width:340,height:210,art:genericArt('RASPBERRY PI','#B34856'),pins:[...pinsAt(['GPIO17','GPIO22','GPIO23','GPIO24','GPIO27'],340,18),...pinsAt(['5V_1','GND_1','3V3_1','GND_2','5V_2','GND_3'],340,202)] },
  ultrasonic: { name:'Sensor ultrasónico', model:'HC-SR04', category:'sensors', width:225,height:128,art:ultrasonic,pins:['VCC','TRIG','ECHO','GND'].map((name,i)=>({name,x:87+i*18,y:124})) },
  flame: {name:'Sensor de flama',model:'AOUT · DOUT',category:'sensors',width:180,height:125,art:sensorArt('FLAME SENSOR'),pins:pinsAt(['VCC','GND','DOUT','AOUT'],180,116)},
  gas: {name:'Sensor de gas MQ-2',model:'AOUT · DOUT',category:'sensors',width:180,height:125,art:sensorArt('MQ-2 GAS'),pins:pinsAt(['VCC','GND','DOUT','AOUT'],180,116)},
  infrared: {name:'Sensor infrarrojo',model:'Seguidor de línea',category:'sensors',width:180,height:125,art:sensorArt('IR LINE'),pins:pinsAt(['VCC','GND','OUT'],180,116)},
  lm35: {name:'Sensor de temperatura',model:'LM35',category:'sensors',width:150,height:125,art:sensorArt('LM35'),pins:pinsAt(['VCC','OUT','GND'],150,116)},
  l298n: {name:'Driver de motor',model:'L298N',category:'outputs',width:220,height:150,art:genericArt('L298N DRIVER','#37495F'),pins:[...pinsAt(['ENA','IN1','IN2','IN3','IN4','ENB'],220,12),...pinsAt(['OUT1','OUT2','OUT3','OUT4'],220,145),{name:'VCC_MOTOR',x:20,y:78},{name:'GND',x:110,y:78},{name:'5V',x:200,y:78}]},
  battery: {name:'Batería',model:'9 V',category:'boards',width:130,height:125,art:genericArt('9V BATTERY','#334155'),pins:[{name:'POSITIVE',x:38,y:120},{name:'NEGATIVE',x:92,y:120}]},
  breadboard: { name:'Protoboard',model:'24 columnas',category:'boards',width:300,height:186,art:breadboard,pins:[...Array.from({length:24},(_,col)=>Array.from({length:10},(_,row)=>({name:`${'abcdefghij'[row]}${col+1}`,x:22.65+col*11,y:row<5?44.65+row*9:113.65+(row-5)*9}))).flat(),...['rail_top_pos','rail_top_neg','rail_bottom_pos','rail_bottom_neg'].flatMap((rail,index)=>Array.from({length:24},(_,col)=>({name:`${rail}_${col+1}`,x:22.65+col*11,y:[20.65,25.65,171.65,176.65][index]})))] },
  led:{name:'LED rojo',model:'5 mm',category:'outputs',width:90,height:110,art:led,pins:[{name:'ANODE',x:34,y:105},{name:'CATHODE',x:56,y:93}]},
  resistor:{name:'Resistencia',model:'220 Ω',category:'boards',width:150,height:50,art:resistor,pins:[{name:'PIN_A',x:2,y:25},{name:'PIN_B',x:148,y:25}]},
  servo:{name:'Microservomotor',model:'9 g · SG90',category:'outputs',width:100,height:115,art:servo,pins:[{name:'GND',x:0,y:112},{name:'VCC',x:4,y:112},{name:'Señal',x:8,y:112}]}
};

export function artwork(type, prefix) {
  const model = componentTypes[type];
  return `<svg viewBox="-4 -4 ${model.width+8} ${model.height+8}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${model.art(prefix)}</svg>`;
}
