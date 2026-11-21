import { componentTypes, artwork } from './circuits-art.js';
import { projects, DEFAULT_PROJECT } from './circuit-projects.js';
import { importCircuitWorkbench } from './src/dev/import-circuit-workbench.ts';
import { circuitSpecs } from './src/dev/circuit-fixtures.ts';
import { evaluate } from './src/modules/circuit/api.ts';
// Light modules only (no Blockly): run the exercise program inside the simulation.
import { ProgramRunner } from './src/modules/runtime/program-runner.ts';
import { generateInstructions } from './src/modules/blocks/generate-instructions.ts';
import { validateProgram } from './src/modules/blocks/validate-program.ts';
import { programForProject, programFromSavedWorkspace } from './src/dev/exercise-programs.ts';
import { createCircuitProgramAdapter } from './src/dev/circuit-program-adapter.ts';

const $ = selector => document.querySelector(selector);
const canvas = $('#circuit-canvas');
const colors = [
  { name:'Coral', value:'#F16C75' }, { name:'Azul noche',value:'#17243B' },
  { name:'Turquesa',value:'#20C997' }, { name:'Morado',value:'#8B72E8' },
  { name:'Azul',value:'#2878F0' }, { name:'Amarillo',value:'#FFB84D' }
];
// Starter: the avoider exercise. state.project names the loaded exercise.
const initial = { project: DEFAULT_PROJECT, ...structuredClone(projects[DEFAULT_PROJECT].circuit) };
let state = structuredClone(initial);
let selection = null;
let pending = null;
let selectedColor = colors[0].value;
let tool = 'select';
let zoom = 1;
const viewCenter = {x:550,y:375};
let drag = null;
let simulationRunning = false;
let savedSnapshot = null;
let scaleEditBefore = null;
const history = [];
const future = [];
const storageKey = 'robokan.circuit-editor.v1';
let sequence = Date.now();


const icon = id => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
const escapeText = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let simulationSummary = '';
// With the simulation running, its result always leads the status bar.
const status = message => { $('#status-message').textContent = simulationRunning && simulationSummary ? simulationSummary + (message ? ` · ${message}` : '') : message; };
const snapshot = () => JSON.stringify(state);

function validateProject(value) {
  if (!value || !Array.isArray(value.components) || !Array.isArray(value.wires) || value.components.length > 60 || value.wires.length > 200) return false;
  if (value.project !== undefined && typeof value.project !== 'string') return false;
  const ids = new Set();
  for (const component of value.components) {
    if (component?.color !== undefined && (component.type !== 'led' || !Object.hasOwn(LED_COLORS, component.color))) return false;
    const scale = component?.scale ?? 1;
    if (!component || typeof component.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(component.id) || ids.has(component.id) || !Object.hasOwn(componentTypes, component.type) || !Number.isFinite(component.x) || !Number.isFinite(component.y) || !Number.isFinite(scale) || scale < 0.5 || scale > 1.5 || component.x < 0 || component.y < 0 || component.x > 1100-componentTypes[component.type].width*scale || component.y > 750-componentTypes[component.type].height*scale-35) return false;
    ids.add(component.id);
  }
  const wireIds = new Set();
  for (const wire of value.wires) {
    if (!wire || typeof wire.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(wire.id) || wireIds.has(wire.id) || !colors.some(color => color.value === wire.color)) return false;
    if (wire.bends !== undefined && (!Array.isArray(wire.bends) || wire.bends.length > 40 || wire.bends.some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)))) return false;
    wireIds.add(wire.id);
    for (const endpoint of [wire.from, wire.to]) {
      const component = value.components.find(item => item.id === endpoint?.component);
      if (!component || !componentTypes[component.type].pins.some(pin => pin.name === endpoint.pin)) return false;
    }
    if (samePin(wire.from,wire.to)) return false;
  }
  return true;
}

try {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    const parsed = JSON.parse(saved);
    for(const wire of parsed.wires??[]) for(const endpoint of [wire.from,wire.to]) {
      const component=parsed.components?.find(item=>item.id===endpoint.component);
      if(component?.type==='led') endpoint.pin={'Ánodo (+)':'ANODE','Cátodo (−)':'CATHODE'}[endpoint.pin]??endpoint.pin;
      if(component?.type==='resistor') endpoint.pin={'1':'PIN_A','2':'PIN_B'}[endpoint.pin]??endpoint.pin;
    }
    if (validateProject(parsed)) { state = parsed; savedSnapshot = snapshot(); status('Proyecto recuperado de este navegador'); }
    else status('El proyecto guardado no es compatible. Se abrió el circuito de inicio.');
  }
} catch { status('No se pudo recuperar el proyecto local. Se abrió el circuito de inicio.'); }

function commit(before = snapshot()) {
  history.push(before);
  if (history.length > 60) history.shift();
  future.length = 0;
}

function updateHistory() {
  $('#undo').disabled = !history.length;
  $('#redo').disabled = !future.length;
  $('#delete-selection').disabled = !selection;
  const saved = savedSnapshot === snapshot();
  $('#save-state').textContent = saved ? 'Guardado en este navegador' : 'Cambios sin guardar';
  $('#save-state').classList.toggle('saved',saved);
}

// LED colours: the red artwork is hue-shifted; the glow and label follow the colour.
const LED_COLORS = {
  red: { label: 'rojo', glow: '#F16C75', filter: '' },
  yellow: { label: 'amarillo', glow: '#FFD54A', filter: 'hue-rotate(52deg) saturate(1.4) brightness(1.15)' },
  green: { label: 'verde', glow: '#4CD07D', filter: 'hue-rotate(115deg) saturate(1.1)' },
};
const CANONICAL_TYPES = { uno:'arduino-uno', pi:'raspberry-pi-4', ultrasonic:'hc-sr04', flame:'flame-sensor', gas:'mq2-gas-sensor', infrared:'ir-line-sensor', lm35:'lm35', led:'led', resistor:'resistor', servo:'servo-sg90', breadboard:'breadboard', motor:'dc-motor', buzzer:'buzzer', l298n:'motor-driver-l298n', battery:'battery-9v' };
const canonicalIdOf = component => CANONICAL_TYPES[component.type] + ':' + /-([1-9]\d*)$/.exec(component.id)?.[1];
function displayName(component) {
  if (component.type === 'led' && component.color && component.color !== 'red') return 'LED ' + LED_COLORS[component.color].label;
  return componentTypes[component.type].name;
}

// ---- Preloaded exercises (circuit-projects.js)
const starterOf = id => ({ project: id, ...structuredClone(projects[id].circuit) });
// Each exercise keeps its own saved block program per board.
const programKeyOf = boardId => state.project ? `${state.project}.${boardId}` : boardId;
function renderProjectInfo() {
  const project = projects[state.project];
  $('#project-title').textContent = project?.title ?? 'Proyecto personalizado';
  $('#project-overview-title').textContent = project?.title ?? 'Proyecto personalizado';
  $('#project-summary').textContent = project?.summary ?? 'Un circuito armado por ti.';
  $('#project-challenge').textContent = project?.challenge ?? 'Elige un ejercicio en la parte superior para empezar con un circuito listo.';
  $('#project-challenge').parentElement.hidden = !project;
  $('#project-select').value = project ? state.project : '';
}
function loadProject(id, { reset = false } = {}) {
  const starter = starterOf(id), before = snapshot();
  if (before !== JSON.stringify(starter)) commit(before);
  state = starter; selection = null; pending = null;
  if (simulationRunning) startSimulationProgram();
  if (reset) {
    try {
      localStorage.removeItem(storageKey);
      // A saved Blockly program for the exercise board would replace the preloaded one.
      for (const component of state.components) localStorage.removeItem('robokan.blocks.workspace.v1.' + programKeyOf(component.id));
    } catch {}
    savedSnapshot = null;
  }
  render();
  status(`${projects[id].title}: circuito listo. ${projects[id].challenge}`);
}

function point(endpoint) {
  const component = state.components.find(item => item.id === endpoint.component);
  const model = componentTypes[component.type];
  const pin = model.pins.find(item => item.name === endpoint.pin);
  const scale=component.scale??1;
  return {x:component.x+pin.x*scale,y:component.y+pin.y*scale,direction:pin.y < model.height/2 ? -1 : 1,component,model};
}

function samePin(first, second) { return first.component === second.component && first.pin === second.pin; }

// Nearest pin to a canvas point. Hit-testing by geometry (not by the topmost
// SVG element) keeps wire ends usable where pins sit only 14 px apart.
function pinNear(position, maxDistance = 9) {
  let nearest = null, best = maxDistance;
  for (const component of state.components) {
    const scale = component.scale ?? 1;
    for (const pin of componentTypes[component.type].pins) {
      const distance = Math.hypot(component.x + pin.x * scale - position.x, component.y + pin.y * scale - position.y);
      if (distance <= best) { best = distance; nearest = { component: component.id, pin: pin.name }; }
    }
  }
  return nearest;
}

// Round the corners of a Manhattan route while keeping both terminals on the pins.
function roundedPath(points, radius = 12) {
  let path = `M${points[0].x},${points[0].y}`;
  for (let index=1; index<points.length-1; index++) {
    const previous=points[index-1], current=points[index], next=points[index+1];
    const before=Math.hypot(current.x-previous.x,current.y-previous.y);
    const after=Math.hypot(next.x-current.x,next.y-current.y);
    const bend=Math.min(radius,before/2,after/2);
    if (!before || !after) continue;
    path+=` L${current.x+(previous.x-current.x)*bend/before},${current.y+(previous.y-current.y)*bend/before} Q${current.x},${current.y} ${current.x+(next.x-current.x)*bend/after},${current.y+(next.y-current.y)*bend/after}`;
  }
  const last=points.at(-1);
  return `${path} L${last.x},${last.y}`;
}

function cablePath(wire,index) {
  const a=point(wire.from), b=point(wire.to);
  return roundedPath([a,...cableBends(wire,index),b]);
}

function cableBends(wire,index) {
  if (Array.isArray(wire.bends)) return wire.bends;
  const a=point(wire.from), b=point(wire.to);
  const lane=index%7;
  const startY=a.y+a.direction*(40+lane*13);
  const endY=b.y+b.direction*(36+lane*13);
  const left=a.component.x < b.component.x ? a : b;
  const right=left===a ? b : a;
  let middle=(left.component.x+left.model.width*(left.component.scale??1)+right.component.x)/2+lane*12-18;
  if (a.component.id===b.component.id) middle=a.component.x+a.model.width*(a.component.scale??1)+35+lane*12;
  return [{x:a.x,y:startY},{x:middle,y:startY},{x:middle,y:endY},{x:b.x,y:endY}];
}

function renderComponents() {
  $('#components-layer').innerHTML=state.components.map(component => {
    const model=componentTypes[component.type];
    const canonicalId = canonicalIdOf(component);
    // Program panel states win; otherwise the live "Iniciar simulación" result.
    const electricalStatus = programComponentStates[canonicalId] ?? (simulationRunning ? simulationStates[canonicalId] : undefined);
    const ledOn = component.type === 'led' && electricalStatus === 'ok';
    const ledColor = LED_COLORS[component.color] ?? LED_COLORS.red;
    const burned = electricalStatus === 'burned';
    const scale=component.scale??1;
    return `<g class="circuit-component" data-component="${component.id}" transform="translate(${component.x} ${component.y}) scale(${scale})" role="button" tabindex="0" aria-label="${model.name}, seleccionar. Usa las flechas para mover.${['uno','pi'].includes(component.type) ? ' Doble clic o Alt+Enter para programar.' : ''}"><title>${model.name} · ${model.model}</title>${selection?.id===component.id ? `<rect class="component-selection" x="-9" y="-9" width="${model.width+18}" height="${model.height+18}" rx="7"/>` : ''}<g filter="url(#component-shadow)"${ledColor.filter ? ` style="filter:${ledColor.filter}"` : ''}>${model.art(component.id)}</g>${ledOn ? `<ellipse class="program-led-glow" cx="45" cy="36" rx="28" ry="30" fill="${ledColor.glow}" opacity=".65" pointer-events="none"/>` : ''}${burned ? burnEffect(component, model) : ''}${electricalStatus ? `<text class="component-program-status${burned ? ' is-burned' : ''}" x="0" y="${model.height+25}">${electricalStatus === 'ok' ? 'Activo' : burned ? '¡Quemado!' : 'Sin alimentación'}</text>` : ''}<text class="component-label" x="0" y="-18">${escapeText(displayName(component))}<tspan class="component-label-id" dx="9">${model.model}</tspan></text></g>`;
  }).join('');
  $('#pins-layer').innerHTML=state.components.map(component => componentTypes[component.type].pins.map(pin => {
    const endpoint={component:component.id,pin:pin.name};
    const name=escapeText(pin.name);
    const scale=component.scale??1;
    return `<g transform="translate(${component.x+pin.x*scale} ${component.y+pin.y*scale})"><circle class="pin-center" r="1.6"/><circle class="pin${pending && samePin(pending,endpoint)?' pending':''}" r="${component.type==='breadboard'?4:6}" data-pin="${name}" data-owner="${component.id}" role="button" tabindex="${component.type==='breadboard'&&pin.name!=='a1'?'-1':'0'}" aria-label="${componentTypes[component.type].name}: pin ${name}${component.type==='breadboard'?'. Usa las flechas para navegar.':''}"><title>${name}</title></circle></g>`;
  }).join('')).join('')+state.wires.map((wire,index)=>{
    const ends=['from','to'].map(end=>{const p=point(wire[end]),active=selection?.kind==='wire'&&selection.id===wire.id;return `<circle class="wire-end-handle" cx="${p.x}" cy="${p.y}" r="16" fill="transparent" stroke="${active?wire.color:'transparent'}" stroke-width="2" style="cursor:grab" data-wire-end="${end}" data-wire-id="${wire.id}" aria-label="Arrastrar extremo del cable ${escapeText(wire[end].pin)}"/>`;}).join('');
    if(selection?.kind!=='wire'||selection.id!==wire.id)return ends;
    const bends=cableBends(wire,index).map((p,bend)=>`<g class="wire-bend-handle" data-wire-bend="${bend}" data-wire-id="${wire.id}" role="button" tabindex="0" aria-label="Mover curva del cable"><circle cx="${p.x}" cy="${p.y}" r="14" fill="transparent" style="cursor:move"/><circle cx="${p.x}" cy="${p.y}" r="6" fill="white" stroke="#2878F0" stroke-width="2" pointer-events="none"/></g>`).join('');
    return ends+bends;
  }).join('');
}

// Burst and smoke drawn over a burned component; an LED also turns dark.
function burnEffect(component, model) {
  const cx = component.type === 'led' ? 45 : model.width - 14, cy = component.type === 'led' ? 34 : 14;
  const star = Array.from({ length: 16 }, (_, i) => { const r = i % 2 ? 9 : 22, a = (Math.PI * i) / 8; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
  return `<g class="burn-effect" pointer-events="none">${component.type === 'led' ? '<path d="M26 56V31a19 19 0 0 1 38 0v25z" fill="#2B2626" opacity=".88"/>' : ''}<polygon class="burn-burst" points="${star}" fill="#FFB84D" stroke="#E8433A" stroke-width="2"/><circle class="burn-smoke" cx="${cx - 6}" cy="${cy - 18}" r="7" fill="#7A7F87"/><circle class="burn-smoke burn-smoke-late" cx="${cx + 7}" cy="${cy - 24}" r="5" fill="#9AA0A8"/></g>`;
}

function renderWires() {
  $('#wires-layer').innerHTML=state.wires.map((wire,index) => {
    const path=cablePath(wire,index), a=point(wire.from), b=point(wire.to);
    const terminalRadius=selection?.id===wire.id?8:3;
    return `<g class="cable${selection?.id===wire.id?' is-selected':''}" data-wire="${wire.id}" role="button" tabindex="0" aria-label="Cable ${escapeText(wire.from.pin)} a ${escapeText(wire.to.pin)}. Selecciónalo para acomodar sus curvas o arrastrar sus extremos"><title>${escapeText(wire.from.pin)} → ${escapeText(wire.to.pin)} · selecciona para acomodar sus curvas</title><path class="cable-hit" d="${path}"/><path class="cable-outline" d="${path}"/><path class="cable-body" d="${path}" stroke="${wire.color}"/><path class="cable-highlight" d="${path}"/><circle class="wire-terminal" cx="${a.x}" cy="${a.y}" r="${terminalRadius}" stroke="${wire.color}"/><circle class="wire-terminal" cx="${b.x}" cy="${b.y}" r="${terminalRadius}" stroke="${wire.color}"/></g>`;
  }).join('');
}

function renderInspector() {
  const component=selection?.kind==='component' ? state.components.find(item=>item.id===selection.id) : null;
  $('#selection-heading').textContent=component ? componentTypes[component.type].name : 'Conexiones';
  $('#selection-details').innerHTML=component ? `<p>${escapeText(componentTypes[component.type].model)} · ${componentTypes[component.type].pins.length} pines. Arrastra para mover o usa las flechas.</p><label class="component-scale-control" for="component-scale">Tamaño <output id="component-scale-value">${Math.round((component.scale??1)*100)}%</output><input id="component-scale" type="range" min="0.5" max="1.5" step="0.05" value="${component.scale??1}" aria-label="Tamaño de ${escapeText(componentTypes[component.type].name)}"></label>` : '';
  $('#wire-count').textContent=state.wires.length;
  const wires=component ? state.wires.filter(wire=>wire.from.component===component.id || wire.to.component===component.id) : state.wires;
  $('#connection-list').innerHTML=wires.length ? wires.map(wire=>`<button class="connection-row${selection?.id===wire.id?' selected':''}" data-wire="${wire.id}" type="button" style="--wire:${wire.color}" aria-label="Seleccionar cable ${escapeText(wire.from.pin)} a ${escapeText(wire.to.pin)}"><span class="wire-line"></span><span class="endpoint">${escapeText(wire.from.pin.replace(/^GND\d$/, 'GND'))}</span>${icon('chevron')}<span class="endpoint">${escapeText(wire.to.pin)}</span></button>`).join('') : '<p class="field-hint">Sin conexiones. Selecciona dos pines para añadir un cable.</p>';
  $('#wire-colors').innerHTML=colors.map(color=>`<button class="color-swatch" type="button" style="--swatch:${color.value}" data-color="${color.value}" title="${color.name}" aria-label="${color.name}" aria-pressed="${color.value===selectedColor}"></button>`).join('');
  $('#floating-colors').innerHTML=$('#wire-colors').innerHTML;
  $('#floating-colors').hidden=selection?.kind!=='wire';
  if (selection?.kind==='wire' && matchMedia('(max-width:1199px)').matches) $('#connection-tip').hidden=true;
}

function render() {
  refreshSimulation();
  renderComponents(); renderWires(); renderInspector(); updateHistory(); renderProjectInfo();
  $('#component-count').textContent=`${state.components.length} componentes`;
  $('#wire-preview').setAttribute('d','');
}

$('#selection-details').addEventListener('pointerdown',event=>{
  if(event.target.closest('#component-scale')&&!scaleEditBefore) scaleEditBefore=snapshot();
});
$('#selection-details').addEventListener('input',event=>{
  if(event.target.id!=='component-scale'||selection?.kind!=='component')return;
  if(!scaleEditBefore)scaleEditBefore=snapshot();
  const component=state.components.find(item=>item.id===selection.id);
  if(!component)return;
  component.scale=Number(event.target.value);
  component.x=Math.min(component.x,1100-componentTypes[component.type].width*component.scale);
  component.y=Math.min(component.y,715-componentTypes[component.type].height*component.scale);
  $('#component-scale-value').value=`${Math.round(component.scale*100)}%`;
  renderComponents();renderWires();updateHistory();
});
$('#selection-details').addEventListener('change',event=>{
  if(event.target.id!=='component-scale'||!scaleEditBefore)return;
  commit(scaleEditBefore);scaleEditBefore=null;updateHistory();status('Tamaño del componente actualizado.');
});

function renderLibrary() {
  const query=$('#component-search').value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const category=$('#component-category').value;
  const entries=Object.entries(componentTypes).filter(([,model])=>(category==='all'||model.category===category)&&`${model.name} ${model.model}`.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(query));
  $('#component-library').innerHTML=entries.map(([type,model])=>`<button class="component-card" type="button" data-add="${type}" aria-label="Añadir ${model.name}"><span class="add-indicator" aria-hidden="true">+</span><span class="component-art">${artwork(type,`library-${type}`)}</span><strong>${model.name}</strong><small>${model.model}</small></button>`).join('');
  $('#library-count').textContent=entries.length;
  $('#empty-search').hidden=!!entries.length;
}

function choosePin(endpoint) {
  if (!pending) { pending=endpoint; selection=null; status(`Pin ${endpoint.pin} seleccionado. Elige el pin de destino. Esc para cancelar.`); render(); return; }
  if (samePin(pending,endpoint)) { cancelWire(); return; }
  const exists=state.wires.some(wire=>(samePin(wire.from,pending)&&samePin(wire.to,endpoint))||(samePin(wire.to,pending)&&samePin(wire.from,endpoint)));
  if (exists) { status('Estos pines ya están conectados. Elige otro pin o pulsa Esc.'); return; }
  if (state.wires.length >= 200) { status('La mesa admite hasta 200 cables. Elimina uno para continuar.'); cancelWire(); return; }
  commit();
  const wire={id:`wire-${++sequence}`,from:pending,to:endpoint,color:selectedColor};
  state.wires.push(wire); pending=null; selection={kind:'wire',id:wire.id};
  render(); status(`Cable conectado: ${wire.from.pin} a ${wire.to.pin}.`);
}

function cancelWire() { pending=null; $('#wire-preview').setAttribute('d',''); render(); status('Listo para construir'); }

function selectWire(id) {
  pending=null; selection={kind:'wire',id}; selectedColor=state.wires.find(wire=>wire.id===id).color;
  render(); status('Cable seleccionado. Cambia su color o elimínalo.');
}

function addComponent(type) {
  if (state.components.length >= 60) { status('La mesa admite hasta 60 componentes. Elimina uno para continuar.'); return; }
  commit();
  const offset=((state.components.length-3)%6)*28;
  const component={id:`${type}-${++sequence}`,type,x:180+offset,y:110+offset};
  state.components.push(component); selection={kind:'component',id:component.id}; pending=null;
  render(); status(`${componentTypes[type].name} añadido a la mesa.`);
  $('#library').classList.remove('open');
}

function deleteSelection() {
  if (!selection) return;
  commit();
  if (selection.kind==='wire') state.wires=state.wires.filter(wire=>wire.id!==selection.id);
  else { state.components=state.components.filter(component=>component.id!==selection.id); state.wires=state.wires.filter(wire=>wire.from.component!==selection.id&&wire.to.component!==selection.id); }
  selection=null; pending=null; render(); status('Selección eliminada. Puedes deshacer este cambio.');
}

function undo() {
  if (!history.length) return;
  future.push(snapshot()); state=JSON.parse(history.pop()); selection=null; pending=null; render(); status('Cambio deshecho');
}
function redo() {
  if (!future.length) return;
  history.push(snapshot()); state=JSON.parse(future.pop()); selection=null; pending=null; render(); status('Cambio rehecho');
}

function canvasPoint(event) {
  return new DOMPoint(event.clientX,event.clientY).matrixTransform(canvas.getScreenCTM().inverse());
}

const programPanel = $('#program-panel');
const programFrame = $('#program-frame');
let lastBoardClick = null;
let programComponentStates = {};
let programReturnFocus = null;
let programCloseTimer = null;

function openBoardProgram(component, withWorld = false) {
  if (programPanel.open || !['uno','pi'].includes(component.type)) return;
  try { sessionStorage.setItem('robokan.program.circuit-transfer', snapshot()); }
  catch { status('No se pudo abrir el programa. Comprueba el almacenamiento del navegador.'); return; }
  const componentNumber = /-([1-9]\d*)$/.exec(component.id)?.[1];
  if (!componentNumber) { status('La placa tiene un identificador incompatible.'); return; }
  const boardSpec = component.type === 'pi' ? 'raspberry-pi-4' : 'arduino-uno';
  const params = new URLSearchParams({ circuit: '1', embedded: '1', board: boardSpec + ':' + componentNumber, programKey: programKeyOf(component.id) });
  if (Object.hasOwn(projects, state.project)) params.set('project', state.project);
  if (withWorld) params.set('world', '1');
  programReturnFocus = component.id;
  $('#program-board-name').textContent = componentTypes[component.type].name + ' · ' + component.id;
  programFrame.src = 'blocks.html?' + params.toString();
  programPanel.showModal();
  requestAnimationFrame(() => { if (programPanel.open) programPanel.classList.add('is-open'); });
}
function requestProgramClose() {
  programFrame.contentWindow?.postMessage({ type: 'robokan:request-close' }, location.origin);
}
$('#close-program-panel').addEventListener('click', requestProgramClose);
$('#open-world').addEventListener('click', () => {
  const isBoard=component=>['uno','pi'].includes(component.type);
  const board = state.components.find(component => component.id === selection?.id && isBoard(component)) ?? state.components.find(isBoard);
  if (!board) { status('Añade una placa para abrir el mundo 3D.'); return; }
  openBoardProgram(board, true);
});
programPanel.addEventListener('cancel', event => { event.preventDefault(); requestProgramClose(); });
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== programFrame.contentWindow || !programPanel.open) return;
  if (event.data?.type === 'robokan:circuit-state') {
    const incoming = event.data.statusByInstance;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return;
    programComponentStates = Object.fromEntries(Object.entries(incoming).filter(([id, value]) => /^[a-z0-9-]+:[1-9]\d*$/.test(id) && ['ok','unpowered','burned'].includes(value)));
    renderComponents();
    return;
  }
  if (event.data?.type !== 'robokan:close-allowed') return;
  programPanel.classList.remove('is-open');
  clearTimeout(programCloseTimer);
  programCloseTimer = setTimeout(() => {
    programPanel.close();
    programFrame.removeAttribute('src');
    // The panel's program no longer drives the circuit: drop its LED states.
    programComponentStates = {};
    renderComponents();
    [...canvas.querySelectorAll('[data-component]')].find(element => element.dataset.component === programReturnFocus)?.focus();
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240);
});
canvas.addEventListener('dblclick', event => {
  if (event.target.closest('[data-pin]')) return;
  const element = event.target.closest('[data-component]');
  const component = state.components.find(candidate => candidate.id === element?.dataset.component);
  if (component&&['uno','pi'].includes(component.type)) { event.preventDefault(); openBoardProgram(component); }
});

canvas.addEventListener('pointerdown',event=>{
  if (event.button!==0) return;
  const wireBend=event.target.closest('[data-wire-bend]');
  if (wireBend) {
    event.preventDefault();
    const id=wireBend.dataset.wireId, index=Number(wireBend.dataset.wireBend);
    const wire=state.wires.find(item=>item.id===id);
    if (!wire) return;
    const before=snapshot();
    if (!Array.isArray(wire.bends)) wire.bends=cableBends(wire,state.wires.indexOf(wire)).map(p=>({...p}));
    selection={kind:'wire',id};pending=null;
    drag={kind:'wire-bend',id,index,pointer:event.pointerId,before};
    canvas.setPointerCapture(event.pointerId);render();return;
  }
  const pin=event.target.closest('[data-pin]');
  if (pin) { event.preventDefault(); choosePin({component:pin.dataset.owner,pin:pin.dataset.pin}); return; }
  const wireEnd=event.target.closest('[data-wire-end]');
  if (wireEnd) {
    event.preventDefault();
    const wire=state.wires.find(item=>item.id===wireEnd.dataset.wireId);
    if (!wire) return;
    // A wire-end handle is larger than the pin gap: if the pointer is really on a
    // neighbouring pin, treat the press as a click on that pin.
    const start=canvasPoint(event), near=pinNear(start);
    if (near && !samePin(near,wire[wireEnd.dataset.wireEnd])) { choosePin(near); return; }
    pending=null; selection={kind:'wire',id:wire.id};
    drag={kind:'wire-end',id:wire.id,end:wireEnd.dataset.wireEnd,pointer:event.pointerId,before:snapshot(),fixed:wire[wireEnd.dataset.wireEnd==='from'?'to':'from'],startX:start.x,startY:start.y,moved:false};
    canvas.setPointerCapture(event.pointerId);
    render();
    const p=canvasPoint(event), a=point(drag.fixed);
    $('#wire-preview').setAttribute('d',roundedPath([a,{x:a.x,y:a.y+a.direction*25},{x:p.x,y:a.y+a.direction*25},p]));
    $('#wire-preview').setAttribute('stroke',wire.color);$('#wire-preview').setAttribute('stroke-width','3');
    status('Suelta el extremo sobre un pin para reconectar el cable. Esc para cancelar.');
    return;
  }
  const wire=event.target.closest('[data-wire]');
  if (wire) { selectWire(wire.dataset.wire); return; }
  const element=event.target.closest('[data-component]');
  if (element) {
    if (tool==='wire') { status('Elige un pin del componente para empezar el cable.'); return; }
    event.preventDefault(); pending=null; selection={kind:'component',id:element.dataset.component};
    const component=state.components.find(item=>item.id===selection.id);
    const now = performance.now();
    if (['uno','pi'].includes(component.type) && lastBoardClick?.id === component.id && now - lastBoardClick.time < 450 && Math.hypot(event.clientX - lastBoardClick.x, event.clientY - lastBoardClick.y) < 8) {
      lastBoardClick = null; drag = null; openBoardProgram(component); return;
    }
    lastBoardClick = ['uno','pi'].includes(component.type) ? { id: component.id, time: now, x: event.clientX, y: event.clientY } : null;
    const position=canvasPoint(event);
    drag={id:component.id,pointer:event.pointerId,startX:position.x,startY:position.y,x:component.x,y:component.y,before:snapshot(),moved:false};
    canvas.setPointerCapture(event.pointerId);
    render();
  } else {
    const hadPending=!!pending;
    selection=null; cancelWire();
    if (!hadPending) {
      drag={kind:'pan',pointer:event.pointerId,clientX:event.clientX,clientY:event.clientY,cx:viewCenter.x,cy:viewCenter.y,scale:canvas.getScreenCTM().a};
      canvas.setPointerCapture(event.pointerId);$('#workspace').classList.add('panning');
    }
  }
});

canvas.addEventListener('pointermove',event=>{
  const position=canvasPoint(event);
  if (drag?.kind==='pan') {
    viewCenter.x=drag.cx-(event.clientX-drag.clientX)/drag.scale;
    viewCenter.y=drag.cy-(event.clientY-drag.clientY)/drag.scale;
    setZoom(zoom);
  } else if (drag?.kind==='wire-bend') {
    const wire=state.wires.find(item=>item.id===drag.id);
    if (wire?.bends?.[drag.index]) {wire.bends[drag.index]={x:Math.max(8,Math.min(1092,position.x)),y:Math.max(8,Math.min(742,position.y))};renderComponents();renderWires();}
  } else if (drag?.kind==='wire-end') {
    if (!drag.moved && Math.hypot(position.x-drag.startX,position.y-drag.startY)<4) return;
    drag.moved=true;
    const a=point(drag.fixed),wire=state.wires.find(item=>item.id===drag.id);
    $('#wire-preview').setAttribute('d',roundedPath([a,{x:a.x,y:a.y+a.direction*25},{x:position.x,y:a.y+a.direction*25},position]));
    $('#wire-preview').setAttribute('stroke',wire?.color||selectedColor);$('#wire-preview').setAttribute('stroke-width','3');
  } else if (drag) {
    const component=state.components.find(item=>item.id===drag.id), model=componentTypes[component.type];
    const dx=position.x-drag.startX,dy=position.y-drag.startY;
    if (!drag.moved && Math.hypot(dx,dy)<3) return;
    drag.moved=true;
    component.x=Math.round(Math.max(15,Math.min(1085-model.width,drag.x+dx)));
    component.y=Math.round(Math.max(25,Math.min(710-model.height,drag.y+dy)));
    renderComponents(); renderWires();
  } else if (pending) {
    const a=point(pending);
    $('#wire-preview').setAttribute('d',roundedPath([a,{x:a.x,y:a.y+a.direction*25},{x:position.x,y:a.y+a.direction*25},position]));
    $('#wire-preview').setAttribute('stroke',selectedColor);
    $('#wire-preview').setAttribute('stroke-width','3');
  }
});

function finishDrag(event) {
  if (!drag || drag.pointer!==event.pointerId) return;
  if (drag.kind==='wire-bend') {
    const current=drag;
    if(event.type==='pointercancel') state=JSON.parse(current.before);
    else if(snapshot()!==current.before) {commit(current.before);status('Curva del cable acomodada. Puedes deshacer este cambio.');}
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    drag=null;render();return;
  }
  if (drag.kind==='wire-end') {
    const current=drag, wire=state.wires.find(item=>item.id===current.id);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    drag=null;$('#wire-preview').setAttribute('d','');
    // A click without dragging behaves like clicking the pin: start a new wire there.
    if (wire && !current.moved && event.type==='pointerup') { choosePin(wire[current.end]); return; }
    const endpoint=event.type==='pointerup' ? pinNear(canvasPoint(event),12) : null;
    if (wire && endpoint) {
      const other=wire[current.end==='from'?'to':'from'];
      const duplicate=state.wires.some(item=>item.id!==wire.id&&((samePin(item.from,endpoint)&&samePin(item.to,other))||(samePin(item.to,endpoint)&&samePin(item.from,other))));
      if (!samePin(endpoint,other)&&!duplicate) {
        commit(current.before);wire[current.end]=endpoint;selection={kind:'wire',id:wire.id};
        status(`Cable reconectado a ${endpoint.pin}.`);
      } else status('No se puede conectar el cable a ese pin. Se conserva su conexión anterior.');
    } else status('No se soltó sobre un pin. Se conserva la conexión anterior.');
    render();return;
  }
  if (drag.kind==='pan') { drag=null;$('#workspace').classList.remove('panning');if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);return; }
  if (drag.moved) lastBoardClick = null;
  if (event.type==='pointercancel') state=JSON.parse(drag.before);
  else if (drag.moved && snapshot()!==drag.before) { commit(drag.before); status('Componente movido. Las conexiones se han mantenido.'); }
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  drag=null; render();
}
canvas.addEventListener('pointerup',finishDrag);
canvas.addEventListener('pointercancel',finishDrag);
canvas.addEventListener('dblclick',event=>{
  const element=event.target.closest('[data-wire]');
  if(!element)return;
  const wire=state.wires.find(item=>item.id===element.dataset.wire);
  if(!wire)return;
  const index=state.wires.indexOf(wire), bends=cableBends(wire,index).map(p=>({...p}));
  const route=[point(wire.from),...bends,point(wire.to)], position=canvasPoint(event);
  let segment=0, nearest=Infinity;
  for(let i=0;i<route.length-1;i++){
    const a=route[i],b=route[i+1],dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((position.x-a.x)*dx+(position.y-a.y)*dy)/(dx*dx+dy*dy||1)));
    const distance=Math.hypot(position.x-(a.x+t*dx),position.y-(a.y+t*dy));
    if(distance<nearest){nearest=distance;segment=i;}
  }
  commit();bends.splice(segment,0,{x:position.x,y:position.y});wire.bends=bends;selection={kind:'wire',id:wire.id};
  render();status('Punto de curva añadido. Arrástralo para acomodar el cable.');
});

canvas.addEventListener('keydown',event=>{
  const pin=event.target.closest('[data-pin]'),wire=event.target.closest('[data-wire]'),componentElement=event.target.closest('[data-component]');
  if (pin && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
    const owner=state.components.find(item=>item.id===pin.dataset.owner);
    if (owner.type==='breadboard') {
      event.preventDefault();
      const pins=[...canvas.querySelectorAll(`[data-owner="${owner.id}"]`)];
      const index=pins.indexOf(pin),col=Math.floor(index/10),row=index%10;
      const nextCol=Math.max(0,Math.min(23,col+(event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0)));
      const nextRow=Math.max(0,Math.min(9,row+(event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0)));
      pin.setAttribute('tabindex','-1');pins[nextCol*10+nextRow].setAttribute('tabindex','0');pins[nextCol*10+nextRow].focus();
    }
  }
  if (['Enter',' '].includes(event.key)) {
    event.preventDefault();
    if (pin) {
      const endpoint={component:pin.dataset.owner,pin:pin.dataset.pin};
      choosePin(endpoint);
      [...canvas.querySelectorAll('[data-pin]')].find(item=>item.dataset.owner===endpoint.component&&item.dataset.pin===endpoint.pin)?.focus();
    }
    else if (wire) selectWire(wire.dataset.wire);
    else if (componentElement) { selection={kind:'component',id:componentElement.dataset.component}; render(); canvas.querySelector(`[data-component="${selection.id}"]`)?.focus(); }
  }
  if (componentElement && event.key === 'Enter' && event.altKey) {
    const component = state.components.find(candidate => candidate.id === componentElement.dataset.component);
    if (['uno','pi'].includes(component?.type)) { event.preventDefault(); openBoardProgram(component); }
  }
  if (componentElement && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
    event.preventDefault();
    const component=state.components.find(item=>item.id===componentElement.dataset.component),model=componentTypes[component.type],step=event.shiftKey?20:5;
    commit(); selection={kind:'component',id:component.id};
    component.x=Math.max(15,Math.min(1085-model.width,component.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0)));
    component.y=Math.max(25,Math.min(710-model.height,component.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)));
    render();canvas.querySelector(`[data-component="${component.id}"]`)?.focus();
  }
});

document.addEventListener('click',event=>{
  const add=event.target.closest('[data-add]'); if (add) addComponent(add.dataset.add);
  const wire=event.target.closest('.connection-row'); if (wire) selectWire(wire.dataset.wire);
  const color=event.target.closest('[data-color]');
  if (color) {
    const palette=color.closest('#floating-colors') ? $('#floating-colors') : $('#wire-colors');
    const value=color.dataset.color;
    if (selection?.kind==='wire') {
      const current=state.wires.find(item=>item.id===selection.id);
      if (current.color!==value) { commit(); current.color=value; }
    }
    selectedColor=value; render(); status(`Color del cable: ${colors.find(item=>item.value===value).name}.`);
    palette.querySelector(`[data-color="${value}"]`)?.focus();
  }
  const toolButton=event.target.closest('[data-tool]'); if (toolButton) setTool(toolButton.dataset.tool);
  if (event.target.closest('[data-help]')) $('#help-dialog').showModal();
  if (event.target.closest('[data-close-dialog]')) event.target.closest('dialog').close();
});

function setTool(value) {
  tool=value; pending=null; render();
  document.querySelectorAll('[data-tool]').forEach(button=>{button.classList.toggle('selected',button.dataset.tool===value);button.setAttribute('aria-pressed',String(button.dataset.tool===value));});
  status(value==='wire'?'Selecciona dos pines para crear un cable.':'Arrastra un componente para moverlo.');
}

function setZoom(value) {
  zoom=Math.max(.6,Math.min(3,value));
  const width=1100/zoom,height=750/zoom;
  canvas.setAttribute('viewBox',`${viewCenter.x-width/2} ${viewCenter.y-height/2} ${width} ${height}`);
  $('#zoom-label').textContent=`${Math.round(zoom*100)}%`;
}

$('#undo').addEventListener('click',undo);
$('#redo').addEventListener('click',redo);
$('#delete-selection').addEventListener('click',deleteSelection);
$('#component-search').addEventListener('input',renderLibrary);
$('#component-category').addEventListener('change',renderLibrary);
$('#zoom-in').addEventListener('click',()=>setZoom(zoom+.1));
$('#zoom-out').addEventListener('click',()=>setZoom(zoom-.1));
function resetView(){viewCenter.x=550;viewCenter.y=375;setZoom(1);}
$('#fit-view').addEventListener('click',resetView);
$('#zoom-label').addEventListener('click',resetView);
$('#dismiss-tip').addEventListener('click',()=>{$('#connection-tip').hidden=true;});
$('#open-library').addEventListener('click',()=>{$('#library').classList.add('open');$('#component-search').focus();});
$('#close-library').addEventListener('click',()=>{$('#library').classList.remove('open');$('#open-library').focus();});

// Restores the current exercise as it comes (undoable) and forgets the saved
// project and its saved board program, so a reload shows the same thing.
$('#reset-project').addEventListener('click',()=>{
  const id = Object.hasOwn(projects, state.project) ? state.project : DEFAULT_PROJECT;
  if (!window.confirm(`Se reemplazará el circuito actual por el ejercicio "${projects[id].title}" tal como viene y se borrarán el proyecto y el programa guardados en este navegador. Puedes deshacerlo con Deshacer. ¿Continuar?`)) return;
  loadProject(id, { reset: true });
});

$('#project-select').innerHTML = Object.entries(projects).map(([id, project]) => `<option value="${id}">${escapeText(project.title)}</option>`).join('');
$('#project-select').addEventListener('change', event => {
  const id = event.target.value;
  if (!Object.hasOwn(projects, id) || id === state.project) return;
  const pristine = Object.hasOwn(projects, state.project) && snapshot() === JSON.stringify(starterOf(state.project));
  if (!pristine && !window.confirm(`Se cargará el ejercicio "${projects[id].title}" y se reemplazará el circuito actual. Puedes volver con Deshacer. ¿Continuar?`)) { renderProjectInfo(); return; }
  loadProject(id);
});

$('#save-project').addEventListener('click',()=>{
  try { localStorage.setItem(storageKey,snapshot());savedSnapshot=snapshot();updateHistory();status('Proyecto guardado en este navegador.'); }
  catch { status('No se pudo guardar: el almacenamiento del navegador no está disponible.'); }
});

let simulationStates = {};
// Program running inside the simulation (board pins drive the circuit).
let simulationRunner = null, simulationDrives = {}, simulationWatch = null, simulationNeedsWorld = false;
const CIRCUIT_ONLY_OPS = new Set(['wait', 'digital_write', 'read_distance']);
const BURN_RULES = new Set(['led_without_resistor', 'reversed_polarity', 'overvoltage_gpio']);
// The board's program for this exercise: the one saved from the blocks editor, else the preloaded one.
function simulationProgram() {
  const board = state.components.find(component => ['uno', 'pi'].includes(component.type));
  if (!board) return null;
  let blocks;
  try { blocks = programFromSavedWorkspace(localStorage.getItem('robokan.blocks.workspace.v1.' + programKeyOf(board.id))); } catch {}
  blocks ??= programForProject(state.project);
  if (!blocks?.length || validateProgram(blocks).length) return null;
  const instructions = generateInstructions(blocks);
  return instructions.every(instruction => CIRCUIT_ONLY_OPS.has(instruction.op)) ? { board, instructions } : { board, needsWorld: true };
}
function startSimulationProgram() {
  stopSimulationProgram();
  const program = simulationProgram();
  simulationNeedsWorld = !!program?.needsWorld;
  if (!program?.instructions) return;
  const boardId = canonicalIdOf(program.board);
  simulationRunner = new ProgramRunner(createCircuitProgramAdapter({
    getGraph: () => importCircuitWorkbench(snapshot()),
    getSpecs: () => circuitSpecs,
    getBoardInstanceId: () => boardId,
    getDrives: () => simulationDrives,
    setDrives: next => { simulationDrives = next; render(); },
    getDistanceCm: () => 30,
  }));
  try { simulationRunner.run(program.instructions, { repeat: true }); }
  catch { simulationRunner = null; return; }
  // Errors (e.g. an LED without resistor driven HIGH) stop the runner: show them.
  simulationWatch = setInterval(() => { if (simulationRunner && simulationRunner.status !== 'running') { clearInterval(simulationWatch); simulationWatch = null; render(); } }, 150);
}
function stopSimulationProgram() {
  clearInterval(simulationWatch); simulationWatch = null;
  simulationRunner?.stop(); simulationRunner = null;
  simulationDrives = {}; simulationNeedsWorld = false;
}
// "El LED rojo", "el sensor ultrasónico": article plus name, keeping acronyms.
const withArticle = (name, capital = true) => `${capital ? 'El' : 'el'} ${/^[A-ZÁÉÍÓÚ][a-záéíóú]/.test(name) ? name[0].toLowerCase() + name.slice(1) : name}`;
const SIMULATION_MESSAGES = {
  led_without_resistor: name => `¡${withArticle(name)} se quemó! No tiene resistencia en serie: pon una resistencia entre la placa y el LED.`,
  reversed_polarity: name => `¡${withArticle(name)} se dañó! Tiene la alimentación invertida: revisa que + vaya a 5V y − a GND.`,
  missing_common_ground: name => `${withArticle(name)} no responde: debe compartir GND con la placa.`,
  overvoltage_gpio: name => `Un pin de ${withArticle(name, false)} recibe más voltaje del que soporta.`,
  missing_power: name => `${withArticle(name)} no recibe energía: revisa sus conexiones de alimentación.`,
};
// Evaluates the circuit for "Iniciar simulación": per-component states for the
// drawing and friendly messages for the status bar.
function simulateCircuit() {
  try {
    const graph = importCircuitWorkbench(snapshot());
    let result;
    try { result = evaluate(graph, circuitSpecs, simulationDrives); }
    catch { result = evaluate(graph, circuitSpecs); }
    const states = { ...result.statusByInstance };
    const running = simulationRunner?.status === 'running';
    // A program stopped by an electrical error: its violations explain why (and what burned).
    const stopped = simulationRunner && simulationRunner.status === 'error' ? simulationRunner : null;
    const violations = [...(stopped?.violations ?? []), ...result.violations];
    for (const violation of stopped?.violations ?? []) if (BURN_RULES.has(violation.ruleId)) states[violation.instanceId] = 'burned';
    const nameOf = instanceId => { const component = state.components.find(item => canonicalIdOf(item) === instanceId); return component ? displayName(component) : instanceId; };
    const messages = new Map();
    for (const violation of violations) {
      if (violation.ruleId === 'floating_pin' || messages.has(violation.instanceId)) continue;
      const message = SIMULATION_MESSAGES[violation.ruleId];
      if (message) messages.set(violation.instanceId, message(nameOf(violation.instanceId)));
    }
    for (const [instanceId, componentStatus] of Object.entries(states)) {
      // While a program runs, LEDs switching off is expected, not a fault.
      if (componentStatus !== 'unpowered' || messages.has(instanceId) || running) continue;
      messages.set(instanceId, instanceId.startsWith('led:')
        ? `${withArticle(nameOf(instanceId))} está apagado: necesita energía de 5V o de un pin programado, pasando por una resistencia.`
        : `${withArticle(nameOf(instanceId))} no recibe energía: revisa sus conexiones de alimentación y GND.`);
    }
    if (stopped?.error && !stopped.violations.length) messages.set('program', `El programa se detuvo: ${stopped.error}`);
    return { states, messages: [...messages.values()], running };
  } catch (error) {
    return { states: {}, messages: [`No se pudo simular el circuito: ${error instanceof Error ? error.message : String(error)}`] };
  }
}
function refreshSimulation() {
  if (!simulationRunning) { simulationStates = {}; simulationSummary = ''; return; }
  const result = simulateCircuit();
  simulationStates = result.states;
  const ok = result.running ? 'Ejecutando el programa de la placa: el circuito sigue sus órdenes.' : '¡El circuito funciona! No hay fallos eléctricos.';
  const world = simulationNeedsWorld ? ' Este programa usa motores: ábrelo en Mundo 3D para verlo en acción.' : '';
  simulationSummary = `Simulación activa · ${result.messages.length ? result.messages.join(' ') : ok}${world}`;
  status('');
}

$('#run-circuit').addEventListener('click',()=>{
  simulationRunning=!simulationRunning;
  const button=$('#run-circuit');
  if(!simulationRunning) {stopSimulationProgram();button.innerHTML=`${icon('check')}Iniciar simulación`;render();status('Simulación detenida.');return;}
  button.innerHTML=`${icon('close')}Detener simulación`;
  startSimulationProgram();
  // The simulation stays live: every edit re-evaluates it (see render).
  render();
});

document.addEventListener('keydown',event=>{
  if (event.target.closest('input,select,textarea') || document.querySelector('dialog[open]')) return;
  const key=event.key.toLowerCase(), command=event.ctrlKey||event.metaKey;
  if (command&&key==='z') {event.preventDefault();event.shiftKey?redo():undo();}
  else if (command&&key==='s') {event.preventDefault();$('#save-project').click();}
  else if (event.key==='Escape') {if ($('#library').classList.contains('open')) {$('#library').classList.remove('open');$('#open-library').focus();} cancelWire();}
  else if (event.key==='Delete'||event.key==='Backspace') {event.preventDefault();deleteSelection();}
  else if (!command&&key==='v') setTool('select');
  else if (!command&&key==='w') setTool('wire');
  else if (event.key==='/') {event.preventDefault();if (matchMedia('(max-width:767px)').matches) $('#library').classList.add('open');$('#component-search').focus();}
});

renderLibrary();render();

