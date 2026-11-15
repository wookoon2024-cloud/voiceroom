export type PanelPoint={x:number;y:number};
export type PanelSize={width:number;height:number};
export type PanelViewport=PanelSize&{left:number;top:number};
export function fitPanel(size:PanelSize,view:PanelViewport):PanelSize{
 return{width:Math.max(1,Math.min(size.width,view.width-16)),height:Math.max(1,Math.min(size.height,view.height-16))};
}
export function clampPanel(point:PanelPoint,size:PanelSize,view:PanelViewport):PanelPoint{
 const fit=fitPanel(size,view);
 return{x:Math.max(view.left+8,Math.min(point.x,view.left+view.width-fit.width-8)),y:Math.max(view.top+8,Math.min(point.y,view.top+view.height-fit.height-8))};
}
export function parsePanelPosition(raw:string|null):PanelPoint|null{
 try{const p=JSON.parse(raw??'null');return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?{x:p.x,y:p.y}:null;}catch{return null;}
}
