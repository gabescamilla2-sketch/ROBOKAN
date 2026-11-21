// Types for circuit-projects.js (static workbench module, plain JavaScript).

export interface WorkbenchEndpoint {
  component: string;
  pin: string;
}

export interface WorkbenchCircuit {
  components: {
    id: string;
    type: string;
    x: number;
    y: number;
    scale?: number;
    color?: "red" | "yellow" | "green";
  }[];
  wires: {
    id: string;
    from: WorkbenchEndpoint;
    to: WorkbenchEndpoint;
    color: string;
  }[];
}

export interface WorkbenchProject {
  title: string;
  summary: string;
  challenge: string;
  circuit: WorkbenchCircuit;
}

export type ProjectId =
  "avoider" | "led-on" | "led-blink" | "traffic-light" | "distance";

export const DEFAULT_PROJECT: ProjectId;
export const projects: Record<ProjectId, WorkbenchProject>;
