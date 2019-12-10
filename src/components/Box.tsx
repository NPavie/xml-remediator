import ListIterator from "./ListIterator";
import ListIterable from "./ListIterable";
import IllegalArgumentException from "./exceptions/IllegalArgumentException";


import QName from './QName';
import Attribute from './Attribute';
import { Properties } from "csstype";
import React, { Fragment } from "react";


import Base64 from './Base64';

import './Box.css';


enum BoxType {
	INLINE,
	BLOCK
}

interface BoxState{
	is_hovered?:boolean,
	is_focused?:boolean,
	is_selected?:boolean
}

/**
 * Box interface for json DTO and React props definition
 */
export interface BoxInterface {
	type:BoxType,
	name?:QName,
	attributes:Array<Attribute>,
	text?:string,
	isReplacedElement:boolean,
	children:Array<Box>,
	cssprops?:Properties,
	// props for state propagation
	parent_path?:string,
	parent_index?:number,
	parent_hovered?:boolean,
	parent_selected?:boolean,
	render_html?:boolean
}




export default class Box extends React.Component<BoxInterface, BoxState> {
    
	public childrenIterable:ListIterable<Box>;
	public path:string = "";
	public key:string = "";


	constructor(props:BoxInterface) {
		super(props);
		this.childrenIterable = ListIterable.from<Box>(this.props.children[Symbol.iterator]());
		this.path = (props.parent_path ? props.parent_path : "") + "/"+ (props.name? props.name.localPart : "text()");
		this.key = this.path + (props.parent_index ? `[${props.parent_index}]` : "[0]");
		this.state = {
			is_selected:false || props.parent_selected,
			is_focused:false,
			is_hovered:false || props.parent_hovered
		};	
	}

	changeHovering(){
		let current_state = this.state;
		this.setState({
			is_hovered:!current_state.is_hovered
		});	
	}

	get children():ListIterator<Box>{
		return this.childrenIterable[Symbol.iterator]() as ListIterator<Box>;
	}

	protected copy():Box{
		let newBox = new Box(this.props);
		newBox.childrenIterable = this.childrenIterable;
		newBox.path = this.path;
		newBox.key = this.key + "-copy";
		return newBox;
	}

	get isBlockAndHasNoBlockChildren():boolean {
		if (this.props.type === BoxType.INLINE)
			return false;
		else {
			var firstChild = this.children.next();
			if (!firstChild.done)
				return (firstChild.value.props.type === BoxType.INLINE)
			else
				return true;
		}
	}

	withName(name:QName) {
		let newBoxProps:BoxInterface = this.props;
		newBoxProps.name = name;
		var newBox = new Box(newBoxProps);
		Object.freeze(newBox);
		return newBox;
	}

	withChildren(children:Array<Box> | ListIterator<Box>) {
		let newBox = this.copy();

		if (children instanceof ListIterator)
			newBox.childrenIterable = ListIterable.from<Box>(children);
		else
			newBox.childrenIterable = ListIterable.from(children[Symbol.iterator]());

		if (this.props.type === BoxType.BLOCK) {
			let hasBlockChildren = null;
			let prevIsAnonymous = null;
			for (let c of newBox.children) {
				if (hasBlockChildren == null)
					hasBlockChildren = (c.props.type === BoxType.BLOCK);
				else if (hasBlockChildren !== (c.props.type === BoxType.BLOCK))
					throw new IllegalArgumentException("block and inline can not be siblings");
				if (c.props.name == null && prevIsAnonymous === true)
					throw new IllegalArgumentException("no adjacent anonymous block boxes");
				prevIsAnonymous = (c.props.name == null);
			}
		} else {
			for (let c of newBox.children)
				if (c.props.type === BoxType.BLOCK)
					throw new IllegalArgumentException("no block inside inline");
		}
		Object.freeze(newBox);
		return newBox;
	}

	/**
	 * TODO: Add box selector callback and box hovering
	 * Reconstruct the box hierarchy as xml within a string.
	 * @param rendering_start_path path from which the rendering should start.
	 * (i.e. for html : "/html[0]/body[0]/", with a trailing slash at the end to only render the content of the body and not the body itsel).
	 */
	computeHtml(rendering_start_path:string):string{

		if (this.path.startsWith(rendering_start_path)){ // Node to render
			// render block and its children
			if(this.props.name){
				let node_name = this.props.name.prefix ? 
						`${this.props.name.prefix}:${this.props.name.localPart}` : 
						`${this.props.name.localPart}`;
				
				let namespaces_map:Map<string,string> = new Map<string,string>();

				// List of attribute and values separated by a space + map of attributes namespaces for those who have a prefix
				let attributes = this.props.attributes.map((attr:Attribute) => {
					if(attr.name.prefix && attr.name.namespace && !namespaces_map.has(attr.name.prefix) ){
						namespaces_map.set(attr.name.prefix,attr.name.namespace);
					}
					let attr_name = attr.name.prefix ? `${attr.name.prefix}:${attr.name.localPart}` : `${attr.name.localPart}`;
					return `${attr_name}="${attr.value}"`
				}).join(' ');
				// Adding the node namespace to the map of namespaces
				if(this.props.name && this.props.name.prefix && this.props.name.namespace && !namespaces_map.has(this.props.name.prefix)){
					namespaces_map.set(this.props.name.prefix,this.props.name.namespace);
				}
				// compute namespaces string
				let namespaces = "";
				namespaces_map.forEach((namespace:string, prefix:string, map:Map<String,String>) => {
					namespaces += `xmlns:${prefix}="${namespace}" `;
				});

				let cssInlined = "";
				if(this.props.cssprops){
					cssInlined = 'style="';
					Object.entries(this.props.cssprops).forEach((temp)=>{
						let value = temp[1];
						if(value){
							cssInlined += `${temp[0]}:${value};`;
						}
					});
					cssInlined += '"';
				}
				
				// Content of the node and node end
				let content = "";
				let node_end = "";
				if(this.props.children.length > 0){
					content = ">";
					for(let i = 0, end = this.props.children.length; i < end; i++){
						content += this.props.children[i].computeHtml(rendering_start_path);
					}
					node_end = `</${node_name}>`;
				} else if(this.props.text){
					content = ">" + this.props.text;
					node_end = `</${node_name}>`;
				} else {
					content = "";
					node_end = "/>";
				}
				// Reconstruct node
				return `<${node_name} ${cssInlined} ${attributes.trim()} ${namespaces.trim()}${content} ${node_end}`;
			} else { // anonymous node (more likely to be textual node)
				if(this.props.children.length > 0) {
					return this.props.children.map((b:Box)=>{
							return b.computeHtml(rendering_start_path);
						}).join("");
				} else if(this.props.text) {
					return this.props.text;
				} else return "";	
			} 
		} else if(this.props.children.length > 0){
				return this.props.children.map((b:Box)=>{
					return b.computeHtml(rendering_start_path);
				}).join("");
		} else return "";
	}

	render(){

		if(this.props.render_html){
			//
			let rendered_content = {__html:this.computeHtml('/html[0]/body[0]/')};
			return <div className="boxlist boxlist--html" dangerouslySetInnerHTML={rendered_content} />;
			// */
			/* iframe rendering
			let rendered_content = this.computeHtml('/'); // recursively compute the html source as a string
			return (<iframe 
				title="html_view"
				src={ "data:text/html;base64, " + Base64.encodeString(rendered_content)} 
				height="100%" width="70%"
				contentEditable={true} />);
			// */	
		} else {

			// rendering the tree on the left, and the content on the right
			let pathes = this.path.split('/').slice(1);
			let block_level = pathes.length - 1;
			let level_indicator = "";
			for(let i = block_level; i--;){
				level_indicator += "---"
			}
			level_indicator += "| - ";
			let modifier = (this.state.is_hovered || this.props.parent_hovered) ? "--mouseover" : "";
			let rendered_children = new Array<JSX.Element>();
			for(let i = this.props.children.length; i--;){
				let b:Box = this.props.children[i];
				rendered_children.unshift(<Box 
						type={b.props.type}
						name={b.props.name}
						attributes={b.props.attributes}
						text={b.props.text}
						children={b.props.children}
						cssprops={b.props.cssprops}
						isReplacedElement={b.props.isReplacedElement}
						parent_hovered={this.state.is_hovered || this.props.parent_hovered}
						parent_path={this.key}
						parent_index={i}
					/>);
			}

			if(block_level === 0) return (
				<div className="boxlist boxlist--raw">
					<table className="boxlist__table">
						<tbody>
							<tr>
								<th className="boxlist__data">Block</th>
								<th className="boxlist__content">Content</th>
							</tr>
							<tr >
								<td className={"box__data"+modifier}
									onMouseOver={(e:any)=>{this.changeHovering()}}
									onMouseOut={(e:any)=>{this.changeHovering()}} >
									{level_indicator + pathes.pop()}
								</td>
								<td className={"box__content"+modifier} >{this.props.text}</td>
							</tr>
							{rendered_children}
						</tbody>
					</table>
				</div>
			); else return (
				<Fragment key={this.key}>
					<tr >
						<td className={"box__data"+modifier}
							onMouseOver={(e:any)=>{this.changeHovering()}}
							onMouseOut={(e:any)=>{this.changeHovering()}} >
							{level_indicator + pathes.pop()}
						</td>
						<td className={"box__content"+modifier} >{this.props.text}</td>
					</tr>	
					{rendered_children}
				</Fragment>);
		}
	}


	updateAndFreezeChildren(parent_path:string, index:number = 0){
		this.path = `${parent_path}/${(this.props.name ? this.props.name.localPart : "text()")}`;
		this.key = this.path + `[${index}]`;
		for(let i = this.props.children.length; i--;){
			this.props.children[i].updateAndFreezeChildren(this.key, i);
			//Object.freeze(this.props.children[i]);
		}
	}

	static parse(jsonString:string){
		let box = new Box(JSON.parse(
				jsonString,
				(key:any, value:any) => {
					if (key === 'children')
						return value.map((v:BoxInterface) => {
							var box = new Box(v);
							//Object.freeze(box);
							return box;
						});
					else if (key === 'name' && value != null)
						return new QName(value);
					else if (key === 'attributes')
						return value.map((attr:Attribute) => {
							return attr;
						});
					else return value;
				}
			) as BoxInterface);
		// update and freeze tree via a secondary function
		// (to add some path data for rendering)
		box.updateAndFreezeChildren("");
		//Object.freeze(box);
		return box;
	}
}