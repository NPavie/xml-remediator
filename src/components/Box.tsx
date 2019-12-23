import ListIterator from "./ListIterator";
import ListIterable from "./ListIterable";
import IllegalArgumentException from "./exceptions/IllegalArgumentException";


import QName from './QName';
import Attribute from './Attribute';
import { Properties } from "csstype";
import React, { Fragment } from "react";


import './Box.css';
import Base64 from "./Base64";

import html5_semantic_css from '../css/html5-semantic.inlined';
import html4 from '../css/html4.inlined';


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
 * Boxes mod of rendering : 
 * - HTML : render the content as html in an iframe with original computed css
 * - SEMANTIC : render the content as html in an iframe with semantic css
 * - TREE : render the content as a table presenting the tree of element that 
 */
export enum BoxRenderMode{
	HTML,
	SEMANTIC,
	TREE
};

export enum Rendering{
	// render as an element with name `getName()` and attributes `getAttributes()`, or as
	// ANONYMOUS if isAnonymous() is true
	DEFAULT,
	// if possible only render the contents (if preserveStyle option allows it and block
	// structure can be preserved), or otherwise render as an element with name `getName()`, or
	// with name "span" or "div" if isAnonymous() is true
	ANONYMOUS,
	// don't render
	SKIP
}

/**
 * Box interface for json DTO and React props definition
 
 * @param {BoxType} type INLINE or BLOCK
 * @param {QName | undefined} name Optional xml name
 * @param {Array<Attribute>} attributes list of the attributes (association of a {QName}name  and a {string}value)
 * @param {string | undefined} text 
 * @param {boolean} isReplacedElement
 * @param {Array<Box>} children 
 * @param {Properties | undefined} cssprops 
 * @param {string | undefined} parent_key key that identifies the parent in a tree, like a path (like /html[0]/body[0])
 * @param {number | undefined} parent_index (should be renamed) index of the Box in its parent children array
 * @param {boolean | undefined} parent_hovered true if the parent is currently hovered
 * @param {boolean | undefined} parent_selected true if the
 * @param {boolean | undefined} virtual true if the element is a virtual box (not in the document tree)
 * @param {BoxRenderMode | undefined} render_mode 
 */
export interface BoxInterface {
	type:BoxType,
	name?:QName,
	attributes:Array<Attribute>,
	text?:string,
	isReplacedElement:boolean,
	children:Array<Box>,
	cssprops?:Properties,
	parent_key?:string,
	parent_index?:number,
	parent_hovered?:boolean,
	parent_selected?:boolean,
	virtual?:boolean,
	render_mode?:BoxRenderMode
}


/**
 * 
 */
export class Box extends React.Component<BoxInterface, BoxState> {
    
	public childrenList:ListIterable<Box>;
	
	public key:string = "";
	public rendering:Rendering = Rendering.DEFAULT;

	/**
	 * Create a Box object from a json BoxInterface object
	 * @param {BoxInterface} props 
	 */
	constructor(props:BoxInterface) {
		super(props);
		//this.children = ListIterable.from<Box>(this.props.children[Symbol.iterator]());
		this.childrenList = new ListIterable(this.props.children[Symbol.iterator]())
		let path = (props.parent_key ? props.parent_key : "") + "/"+ (props.name? props.name.localPart : "text()");
		this.key = path + (props.parent_index ? `[${props.parent_index}]` : "[0]");
		this.state = {
			is_selected:false || props.parent_selected,
			is_focused:false,
			is_hovered:false || props.parent_hovered
		};	
	}

	get children(){
		return this.childrenList[Symbol.iterator]() as ListIterator<Box>;
	}

	protected copyProps(){
		return {
			attributes:this.props.attributes.slice(0),
			children:this.props.children.slice(0),
			type:this.props.type,
			name:this.props.name,
			text:this.props.text,
			isReplacedElement:this.props.isReplacedElement,
			cssprops:this.props.cssprops,
			parent_key:this.props.parent_key,
			parent_index:this.props.parent_index,
			parent_hovered:this.props.parent_hovered,
			parent_selected:this.props.parent_selected,
			virtual:this.props.virtual,
			render_mode:this.props.render_mode
		} as BoxInterface;
	}

	public copy(args ?: {name?:QName, attributes?:Map<QName,string>, children?:ListIterator<Box>|Array<Box>, rendering?:Rendering}):Box{
		// create a props copy
		let newProps:BoxInterface = this.copyProps();
		if(args && args.name) newProps.name = args.name;
		if(args && args.attributes){
			let attrArray = new Array<Attribute>();
			args.attributes.forEach((val:string,key:QName)=>{
				attrArray.push({name:key, value:val} as Attribute);
			});
			newProps.attributes = attrArray;
		}
		if(args && args.children && args.children instanceof Array){
			newProps.children = args.children.slice(0);
		}
		let newBox = new Box(newProps);
		
		if(args && args.children && args.children instanceof ListIterator){
			newBox.childrenList = new ListIterable<Box>(args.children);
		} else {
			newBox.childrenList = new ListIterable<Box>(this.childrenList[Symbol.iterator]() as ListIterator<Box>);
		}
		
		newBox.rendering = (args && args.rendering) ? args.rendering : this.rendering;
		newBox.key = this.key;
		
		//newBox.key = this.key + "-copy";
		// update children keys
		//for(let i = 0, end = newBox.props.children.length; i<end; ++i){
		//	newBox.props.children[i].updateKeys(newBox.key);
		//}
		return newBox;
	}

	changeHovering(){
		let current_state = this.state;
		this.setState({
			is_hovered:!current_state.is_hovered
		});	
	}

//	get children():ListIterator<Box>{
//		return this.childrenIterable[Symbol.iterator]() as ListIterator<Box>;
//	}

	

	private _isBlockAndHasNoBlockChildren?:boolean;
	isBlockAndHasNoBlockChildren():boolean {
		if(this._isBlockAndHasNoBlockChildren == null){
			if (this.props.type === BoxType.INLINE)
				this._isBlockAndHasNoBlockChildren = false;
			else {
				var firstChild = this.children.next();
				if (!firstChild.done)
					this._isBlockAndHasNoBlockChildren = (firstChild.value.props.type === BoxType.INLINE)
				else this._isBlockAndHasNoBlockChildren = true;
			}
		}
		return this._isBlockAndHasNoBlockChildren;
		
	}

	isReplacedElement(){
		return this.props.isReplacedElement;
	}

	private _hasText?:boolean;
	hasText():boolean{
		if(this.hasText == null){
			this._hasText = this.props.type == BoxType.INLINE && this.props.text != null && this.props.text !== "";
		}
		return this._hasText!;
	}

	isAnonymous(){
		return this.getName() == null;
	}

	getName(){
		return this.props.name;
	}

	attributes?:Map<QName,string>;
	getAttributes(){
		if(this.attributes == null){
			this.attributes = new Map<QName,string>();
			this.props.attributes.forEach((attr:Attribute)=>{
				this.attributes!.set(attr.name,attr.value);
			});
		}
		return this.attributes;
	}



	withName(name:QName) {
		let newBoxProps:BoxInterface = this.props;
		newBoxProps.name = name;
		var newBox = new Box(newBoxProps);
		Object.freeze(newBox);
		return newBox;
	}

	withChildren(children:Array<Box> | ListIterator<Box>) {
		let newBox = this.copy({children:children});
		
		if (this.props.type === BoxType.BLOCK) {
			let hasBlockChildren = null;
			let prevIsAnonymous = null;
			for (let c of newBox.childrenList) {
				if (hasBlockChildren == null)
					hasBlockChildren = (c.props.type === BoxType.BLOCK);
				else if (hasBlockChildren !== (c.props.type === BoxType.BLOCK))
					throw new IllegalArgumentException("block and inline can not be siblings");
				if (c.props.name == null && prevIsAnonymous === true)
					throw new IllegalArgumentException("no adjacent anonymous block boxes");
				prevIsAnonymous = (c.props.name == null);
			}
		} else {
			for (let c of newBox.childrenList)
				if (c.props.type === BoxType.BLOCK)
					throw new IllegalArgumentException("no block inside inline");
		}
		Object.freeze(newBox);
		return newBox;
	}

	/** REACT RENDERING SECTION */

	/**
	 * TODO: 
	 * - Add box selector callback 
	 * - Add box hovering
	 * - 
	 * Reconstruct the box hierarchy as xml within a string.
	 * @param rendering_start_path path from which the rendering should start.
	 * (i.e. for html : "/html[0]/body[0]/", with a trailing slash at the end to only render the content of the body and not the body itsel).
	 */
	computeHtml(rendering_start_path:string):string{
		if (this.key.startsWith(rendering_start_path)){ // Node to render
			// render block and its children
			if(this.props.name){
				let node_name = this.props.name.prefix ? 
						`${this.props.name.prefix}:${this.props.name.localPart}` : 
						`${this.props.name.localPart}`;
				
				let namespaces_map:Map<string,string> = new Map<string,string>();

				// List of attribute and values separated by a space + map of attributes namespaces for those who have a prefix
				let attributes_array = this.props.attributes.map((attr:Attribute) => {
					if(attr.name.prefix && attr.name.namespace && !namespaces_map.has(attr.name.prefix) ){
						namespaces_map.set(attr.name.prefix,attr.name.namespace);
					}
					let attr_name = attr.name.prefix ? `${attr.name.prefix}:${attr.name.localPart}` : `${attr.name.localPart}`;
					return `${attr_name}="${attr.value}"`
				});
				
				attributes_array.push(`id="${this.key}"`)
				let attributes = attributes_array.join(' ');
				
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
				
				// use ${cssInlined} for computed css from the original document
				return `<${node_name} ${attributes.trim()} ${namespaces.trim()}${content}${node_end}`;
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

	
	
	/**
	 * React rendering function
	 * TODO : only change the tree based on 
	 */
	render(){
		
		if(this.props.render_mode == BoxRenderMode.HTML 
				|| this.props.render_mode == BoxRenderMode.SEMANTIC ){
			
			/* 
			let rendered_content = {__html:this.computeHtml('/html[0]/body[0]/')};
			return <div className="boxlist boxlist--html"  dangerouslySetInnerHTML={rendered_content} />;
			// */
			// iframe rendering
			// Create a copy of the children tree
			let rendered_children = this.props.children.slice(0);

			// new css style tag
			let css = new Box({
				text:this.props.render_mode == BoxRenderMode.HTML ? html4 : html5_semantic_css,
				attributes:[],
				name:new QName({
					prefix:"",
					namespace:"http://www.w3.org/1999/xhtml",
					localPart:"style"
				}),
				children:[],
				type:BoxType.INLINE,
				isReplacedElement:false,
				virtual:true
			});
			
			// Create a virtual head to be rendered 
			let head_children = new Array<Box>();
			let existing_head = this.selectBox('/html[0]/head[0]');
			if(existing_head) { // copy existing head children if the
				head_children = existing_head.props.children.slice(0);
			}
			head_children.push(css);

			let head = new Box({
				attributes:existing_head?existing_head.props.attributes.slice(0):[],
				name:new QName({
					prefix:"",
					namespace:"http://www.w3.org/1999/xhtml",
					localPart:"head"
				}),
				children:head_children,
				type:BoxType.BLOCK,
				isReplacedElement:false,
				virtual:true,
			});
			head.updateKeys('/html[0]',0);
			rendered_children.unshift(head);
			
			let rendered_box_props = {
				type: this.props.type,
				name: this.props.name,
				attributes: this.props.attributes,
				text: this.props.text,
				isReplacedElement: this.props.isReplacedElement,
				children: rendered_children,
				cssprops: this.props.cssprops,
				parent_key: this.props.parent_key,
				parent_index: this.props.parent_index,
				parent_hovered: this.props.parent_hovered,
				parent_selected: this.props.parent_selected,
				hide: this.props.virtual,
				render_mode: this.props.render_mode
			};
			rendered_box_props.children = rendered_children;
			let rendered_box = new Box(rendered_box_props);
			rendered_box.key = '/html[0]';

			let rendered_content = rendered_box.computeHtml('/'); // recursively compute the html source as a string
			console.log(rendered_content);
			return (<iframe 
				title="html_view"
				//srcDoc={rendered_content} // not compatible with edge and legacy browser
				src={ "data:text/html;charset=utf-8, " + encodeURIComponent(rendered_content)} // + Base64.encodeString(rendered_content)} 
				height="100%" width="70%"
				contentEditable={true} />);
			// */	
		} else {
			
			// rendering the tree on the left, and the content on the right
			let pathes = this.key.split('/').slice(1);
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
				if(!b.props.virtual){
					rendered_children.unshift(<Box 
						type={b.props.type}
						name={b.props.name}
						attributes={b.props.attributes}
						text={b.props.text}
						children={b.props.children}
						cssprops={b.props.cssprops}
						isReplacedElement={b.props.isReplacedElement}
						parent_hovered={this.state.is_hovered || this.props.parent_hovered}
						parent_key={this.key}
						parent_index={i}
						virtual={b.props.virtual}
						render_mode={this.props.render_mode}
					/>);
				}
				
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

	/**
	 * Insert a specified box within the boxtree right after the specified key
	 * @param key key of the box in which the new box should be inserted
	 * @param box box to be inserted
	 */
	unshiftBox(key:string, box:Box){
		// Trim all "/" at the end of path
		while(key.endsWith('/')){
			key = key.substr(0,key.length - 1);
		}
		if(key === this.key){
			// Add the box at the begining of the children array of the current box
			this.props.children.unshift(box);
			
		} else if(key.startsWith(this.key)){
			let selection = this.selectBox(key);
			if(selection) selection.unshiftBox(key,box);
		} else {
			console.log(`${key} was not found in the box tree`);
		}
	}

	/**
	 * Search and return a box in the tree from its key.
	 * The `undefined` value is returned if no box is found for the key.
	 * @param key key to be searched in the tree
	 * @return {Box|undefined} either the box found or `undefined` if no corresponding box were found
	 */
	selectBox(key:string):Box|undefined{
		while(key.endsWith('/')){
			key = key.substr(0, key.length - 1);
		}
		if(this.key === key 
				|| (key.startsWith(this.key) && key.length - this.key.length <= 3) ){// if its an incomplete key like /html[0]/hea[0]/style 
			return this;
		} else for(let i = 0, end = this.props.children.length; i < end; ++i){
			if (key.startsWith(this.props.children[i].key)){
				
				let selection = this.props.children[i].selectBox(key);
				if(selection) return selection;
			}	
		}
		return undefined;
	}


	/**
	 * Update the keys
	 * @param parent_key 
	 * @param index 
	 */
	updateKeys(parent_key?:string, index:number = 0){
		
		this.key = `${parent_key ? parent_key : ""}/${(this.props.name ? this.props.name.localPart : "text()")}[${index}]`;
		for(let i = this.props.children.length; i--;){
			this.props.children[i].updateKeys(this.key, i);
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
		box.updateKeys("");
		//Object.freeze(box);
		return box;
	}
}