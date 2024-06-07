import * as dat from "three/examples/jsm/libs/lil-gui.module.min";
import * as OBC from "@thatopen/components";
import * as OBCF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import Stats from "three/examples/jsm/libs/stats.module.js";
import * as CUI from "@thatopen/ui-obc";

const SERVER_BASE_URL = "http://localhost:3000/files/models";

export async function initializeViewer(modelId: string) {
  let modelUrl = `${SERVER_BASE_URL}/${modelId}`;
  console.log(modelUrl);

  BUI.Manager.registerComponents();
  
  const viewport = BUI.Component.create<BUI.Viewport>(() => {
    return BUI.html`<bim-viewport></bim-viewport>`;
  });

  const components = new OBC.Components();

  const worlds = components.get(OBC.Worlds);

  const world = worlds.create<
    OBC.SimpleScene,
    OBC.SimpleCamera,
    OBC.SimpleRenderer
  >();

  world.scene = new OBC.SimpleScene(components);
  world.renderer = new OBC.SimpleRenderer(components, viewport);
  world.camera = new OBC.SimpleCamera(components);

  components.init();

  world.scene.setup();

  world.camera.controls.setLookAt(12, 6, 8, 0, 0, -10);

  const grids = components.get(OBC.Grids);
  grids.create(world);

  const loader = components.get(OBCF.IfcStreamer);
  loader.world = world;
  loader.url = `${modelUrl}/`; // implicitly loads ifc-processed-global and ifc-processed-geometries-0 files from this url
  loader.culler.threshold = 20;
  loader.culler.maxHiddenTime = 1000;
  loader.culler.maxLostTime = 40000;

  // inline function to load a model
  async function loadModel() {
    const geometryURL = `${modelUrl}/ifc-processed.json`;
    const propertiesURL = `${modelUrl}/ifc-processed-properties.json`;
    const rawGeometryData = await fetch(geometryURL);
    const geometryData = await rawGeometryData.json();
    let propertiesData;
    if (propertiesURL) {
      const rawPropertiesData = await fetch(propertiesURL);
      propertiesData = await rawPropertiesData.json();
    }
  
    const model = await loader.load(geometryData, true, propertiesData);
    console.log("Model loaded");
    console.log(model);
  }

  // initially load given model
  loadModel();

  // updating streamer
  world.camera.controls.addEventListener("sleep", () => {
    loader.culler.needsUpdate = true;
  });

  // inline function to clear cache
  async function clearCache() {
    await loader.clearCache();
    window.location.reload();
    console.log("Cache cleared");
  }

  // activate cache
  loader.useCache = true;

  // define properties table
  const [propertiesTable, updatePropertiesTable] = CUI.tables.elementProperties({
    components,
    fragmentIdMap: {},
  });
  
  propertiesTable.preserveStructureOnFilter = true;
  propertiesTable.indentationInText = false;

  const highlighter = components.get(OBCF.Highlighter);
  highlighter.setup({ world });

  highlighter.events.select.onHighlight.add((fragmentIdMap) => {
    updatePropertiesTable({ fragmentIdMap });
  });

  highlighter.events.select.onClear.add(() =>
    updatePropertiesTable({ fragmentIdMap: {} }),
  );
  
  // define properties panel
  const propertiesPanel = BUI.Component.create(() => {
    const onTextInput = (e: Event) => {
      const input = e.target as BUI.TextInput;
      propertiesTable.queryString = input.value !== "" ? input.value : null;
    };
  
    const expandTable = (e: Event) => {
      const button = e.target as BUI.Button;
      propertiesTable.expanded = !propertiesTable.expanded;
      button.label = propertiesTable.expanded ? "Collapse" : "Expand";
    };
  
    return BUI.html`
      <bim-panel label="Properties">
        <bim-panel-section label="Element Data">
          <div style="display: flex; gap: 0.5rem;">
            <bim-button @click=${expandTable} label=${propertiesTable.expanded ? "Collapse" : "Expand"}></bim-button> 
            <bim-text-input @input=${onTextInput} placeholder="Search Property" debounce="250"></bim-text-input> 
          </div>
          ${propertiesTable}
        </bim-panel-section>
      </bim-panel>
    `;
  });

  // add properties panel
  const app = document.createElement("bim-grid");
  app.layouts = {
    main: {
      // bottom row
      template: `
        "viewport 1fr"
        "propertiesPanel 1fr"
      `,
      // left side panel
      /*template: `
        "propertiesPanel viewport"
        /25rem 1fr
      `,*/
      elements: { propertiesPanel, viewport },
    },
  };

  app.layout = "main";
  document.body.append(app);
  
  setTimeout(
    () => window.dispatchEvent(new Event('resize')),
    200 
  );

  // GUI
  const gui = new dat.GUI();

  const params = {
    textField: modelId
  }

  gui.add(params, "textField").name( 'Model ID' ).onFinishChange((value: string) => {
    modelUrl = `${SERVER_BASE_URL}/${value}`;
  });

  gui.add({ loadModel }, "loadModel").name( 'Load Model');
  gui.add({ clearCache }, "clearCache").name( 'Clear Model Cache ');

  // measuring performance
  const stats = new Stats();
  stats.showPanel(2);
  document.body.append(stats.dom);
  stats.dom.style.left = "0px";
  stats.dom.style.zIndex = "unset";
  world.renderer.onBeforeUpdate.add(() => stats.begin());
  world.renderer.onAfterUpdate.add(() => stats.end());
}


