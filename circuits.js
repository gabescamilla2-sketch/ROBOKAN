import { componentTypes, artwork } from './circuits-art.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#circuit-canvas');
const colors = [
  { name:'Coral', value:'#F16C75' }, { name:'Azul noche',value:'#17243B' },
  { name:'Turquesa',value:'#20C997' }, { name:'Morado',value:'#8B72E8' },
  { name:'Azul',value:'#2878F0' }, { name:'Amarillo',value:'#FFB84D' }
];
const initial = {
  components:[{id:'uno-1',type:'uno',x:115,y:305},{id:'sensor-1',type:'ultrasonic',x:670,y:166},{id:'breadboard-1',type:'breadboard',x:640,y:444}],
  wires:[
    {id:'wire-1',from:{component:'uno-1',pin:'5V'},to:{component:'sensor-1',pin:'VCC'},color:'#F16C75'},
    {id:'wire-2',from:{component:'uno-1',pin:'GND1'},to:{component:'sensor-1',pin:'GND'},color:'#17243B'},
    {id:'wire-3',from:{component:'uno-1',pin:'D9'},to:{component:'sensor-1',pin:'TRIG'},color:'#20C997'},
    {id:'wire-4',from:{component:'uno-1',pin:'D10'},to:{component:'sensor-1',pin:'ECHO'},color:'#8B72E8'}
  ]
};
let state = structuredClone(initial);
let selection = null;
let pending = null;
let selectedColor = colors[0].value;
let tool = 'select';
let zoom = 1;
const viewCenter = {x:550,y:375};
let drag = null;
let savedSnapshot = null;
const history = [];
const future = [];
const storageKey = 'robokan.circuit-editor.v1';
let sequence = Date.now();

const icon = id => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
const escapeText = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const status = message => { $('#status-message').textContent = message; };
const snapshot = () => JSON.stringify(state);

function validateProject(value) {
  if (!value || !Array.isArray(value.components) || !Array.isArray(value.wires) || value.components.length > 60 || value.wires.length > 200) return false;
  const ids = new Set();
  for (const component of value.components) {
    if (!component || typeof component.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(component.id) || ids.has(component.id) || !Object.hasOwn(componentTypes, component.type) || !Number.isFinite(component.x) || !Number.isFinite(component.y) || component.x < 0 || component.y < 0 || component.x > 1100-componentTypes[component.type].width || component.y > 750-componentTypes[component.type].height-35) return false;
    ids.add(component.id);
  }
  const wireIds = new Set();
  for (const wire of value.wires) {
    if (!wire || typeof wire.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(wire.id) || wireIds.has(wire.id) || !colors.some(color => color.value === wire.color)) return false;
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

function point(endpoint) {
  const component = state.components.find(item => item.id === endpoint.component);
  const model = componentTypes[component.type];
  const pin = model.pins.find(item => item.name === endpoint.pin);
  return {x:component.x+pin.x,y:component.y+pin.y,direction:pin.y < model.height/2 ? -1 : 1,component,model};
}

function samePin(first, second) { return first.component === second.component && first.pin === second.pin; }

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
  const lane=index%7;
  const startY=a.y+a.direction*(40+lane*13);
  const endY=b.y+b.direction*(36+lane*13);
  const left=a.component.x < b.component.x ? a : b;
  const right=left===a ? b : a;
  let middle=(left.component.x+left.model.width+right.component.x)/2+lane*12-18;
  if (a.component.id===b.component.id) middle=a.component.x+a.model.width+35+lane*12;
  return roundedPath([a,{x:a.x,y:startY},{x:middle,y:startY},{x:middle,y:endY},{x:b.x,y:endY},b]);
}

function renderComponents() {
  $('#components-layer').innerHTML=state.components.map(component => {
    const model=componentTypes[component.type];
    return `<g class="circuit-component" data-component="${component.id}" transform="translate(${component.x} ${component.y})" role="button" tabindex="0" aria-label="${model.name}, seleccionar. Usa las flechas para mover."><title>${model.name} · ${model.model}</title>${selection?.id===component.id ? `<rect class="component-selection" x="-9" y="-9" width="${model.width+18}" height="${model.height+18}" rx="7"/>` : ''}<g filter="url(#component-shadow)">${model.art(component.id)}</g><text class="component-label" x="0" y="-18">${model.name}<tspan class="component-label-id" dx="9">${model.model}</tspan></text></g>`;
  }).join('');
  $('#pins-layer').innerHTML=state.components.map(component => componentTypes[component.type].pins.map(pin => {
    const endpoint={component:component.id,pin:pin.name};
    const name=escapeText(pin.name);
    return `<g transform="translate(${component.x+pin.x} ${component.y+pin.y})"><circle class="pin-center" r="1.6"/><circle class="pin${pending && samePin(pending,endpoint)?' pending':''}" r="${component.type==='breadboard'?4:6}" data-pin="${name}" data-owner="${component.id}" role="button" tabindex="${component.type==='breadboard'&&pin.name!=='a1'?'-1':'0'}" aria-label="${componentTypes[component.type].name}: pin ${name}${component.type==='breadboard'?'. Usa las flechas para navegar.':''}"><title>${name}</title></circle></g>`;
  }).join('')).join('');
}

function renderWires() {
  $('#wires-layer').innerHTML=state.wires.map((wire,index) => {
    const path=cablePath(wire,index), a=point(wire.from), b=point(wire.to);
    return `<g class="cable${selection?.id===wire.id?' is-selected':''}" data-wire="${wire.id}" role="button" tabindex="0" aria-label="Cable ${escapeText(wire.from.pin)} a ${escapeText(wire.to.pin)}"><title>${escapeText(wire.from.pin)} → ${escapeText(wire.to.pin)}</title><path class="cable-hit" d="${path}"/><path class="cable-outline" d="${path}"/><path class="cable-body" d="${path}" stroke="${wire.color}"/><path class="cable-highlight" d="${path}"/><circle class="wire-terminal" cx="${a.x}" cy="${a.y}" r="3" stroke="${wire.color}"/><circle class="wire-terminal" cx="${b.x}" cy="${b.y}" r="3" stroke="${wire.color}"/></g>`;
  }).join('');
}

function renderInspector() {
  const component=selection?.kind==='component' ? state.components.find(item=>item.id===selection.id) : null;
  $('#selection-heading').textContent=component ? componentTypes[component.type].name : 'Conexiones';
  $('#selection-details').textContent=component ? `${componentTypes[component.type].model} · ${componentTypes[component.type].pins.length} pines. Arrastra para mover o usa las flechas del teclado.` : '';
  $('#wire-count').textContent=state.wires.length;
  const wires=component ? state.wires.filter(wire=>wire.from.component===component.id || wire.to.component===component.id) : state.wires;
  $('#connection-list').innerHTML=wires.length ? wires.map(wire=>`<button class="connection-row${selection?.id===wire.id?' selected':''}" data-wire="${wire.id}" type="button" style="--wire:${wire.color}" aria-label="Seleccionar cable ${escapeText(wire.from.pin)} a ${escapeText(wire.to.pin)}"><span class="wire-line"></span><span class="endpoint">${escapeText(wire.from.pin.replace(/^GND\d$/, 'GND'))}</span>${icon('chevron')}<span class="endpoint">${escapeText(wire.to.pin)}</span></button>`).join('') : '<p class="field-hint">Sin conexiones. Selecciona dos pines para añadir un cable.</p>';
  $('#wire-colors').innerHTML=colors.map(color=>`<button class="color-swatch" type="button" style="--swatch:${color.value}" data-color="${color.value}" title="${color.name}" aria-label="${color.name}" aria-pressed="${color.value===selectedColor}"></button>`).join('');
  $('#floating-colors').innerHTML=$('#wire-colors').innerHTML;
  $('#floating-colors').hidden=selection?.kind!=='wire';
  if (selection?.kind==='wire' && matchMedia('(max-width:1199px)').matches) $('#connection-tip').hidden=true;
}

function render() {
  renderComponents(); renderWires(); renderInspector(); updateHistory();
  $('#component-count').textContent=`${state.components.length} componentes`;
  $('#wire-preview').setAttribute('d','');
}

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

canvas.addEventListener('pointerdown',event=>{
  if (event.button!==0) return;
  const pin=event.target.closest('[data-pin]');
  if (pin) { event.preventDefault(); choosePin({component:pin.dataset.owner,pin:pin.dataset.pin}); return; }
  const wire=event.target.closest('[data-wire]');
  if (wire) { selectWire(wire.dataset.wire); return; }
  const element=event.target.closest('[data-component]');
  if (element) {
    if (tool==='wire') { status('Elige un pin del componente para empezar el cable.'); return; }
    event.preventDefault(); pending=null; selection={kind:'component',id:element.dataset.component};
    const component=state.components.find(item=>item.id===selection.id);
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
  if (drag.kind==='pan') { drag=null;$('#workspace').classList.remove('panning');if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);return; }
  if (event.type==='pointercancel') state=JSON.parse(drag.before);
  else if (drag.moved && snapshot()!==drag.before) { commit(drag.before); status('Componente movido. Las conexiones se han mantenido.'); }
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  drag=null; render();
}
canvas.addEventListener('pointerup',finishDrag);
canvas.addEventListener('pointercancel',finishDrag);

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

$('#save-project').addEventListener('click',()=>{
  try { localStorage.setItem(storageKey,snapshot());savedSnapshot=snapshot();updateHistory();status('Proyecto guardado en este navegador.'); }
  catch { status('No se pudo guardar: el almacenamiento del navegador no está disponible.'); }
});

$('#check-circuit').addEventListener('click',()=>{
  const uno=state.components.find(item=>item.type==='uno'),sensor=state.components.find(item=>item.type==='ultrasonic');
  const expected=[['5V','VCC'],['GND1','GND'],['D9','TRIG'],['D10','ECHO']];
  const results=expected.map(([from,to])=>{
    const aliases=from==='GND1'?['GND','GND1','GND2']:[from];
    const connected=!!uno && !!sensor && state.wires.some(wire=>{
      const pairs=[[wire.from,wire.to],[wire.to,wire.from]];
      return pairs.some(([a,b])=>a.component===uno.id && aliases.includes(a.pin) && b.component===sensor.id && b.pin===to);
    });
    return {label:`${from==='GND1'?'GND':from} → ${to}`,connected};
  });
  const count=results.filter(result=>result.connected).length;
  $('#check-summary').textContent=!uno||!sensor?'Añade una placa Uno y un sensor HC-SR04 para revisar el cableado.':`${count} de 4 conexiones del proyecto de inicio están presentes.`;
  $('#check-results').innerHTML=results.map(result=>`<li class="${result.connected?'':'missing'}">${icon(result.connected?'check':'close')}<span>${result.label}</span><span style="margin-left:auto;color:var(--muted)">${result.connected?'Conectado':'Pendiente'}</span></li>`).join('');
  $('#check-dialog').showModal();
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
