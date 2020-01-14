import ListIterator from "./ListIterator";
import ListIterable from "./ListIterable";
import IllegalArgumentException from "./exceptions/IllegalArgumentException";


import QName from './QName';
import Attribute from './Attribute';
import { Properties } from "csstype";
import React, { Fragment, ReactElement } from "react";


import Base64 from "./Base64";

import "../css/html5-semantic-classes.css";

import html5_semantic_css from '../css/html5-semantic.inlined';
import html4 from '../css/html4.inlined';


export enum BoxType {
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
	hovered_key?:string,
	selected_key?:string,
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
			is_selected:(props.selected_key ? this.key.startsWith(props.selected_key) : false),
			is_focused:false,
			is_hovered:(props.hovered_key ? this.key.startsWith(props.hovered_key) : false) 
		};
	}


	//// BOX STRUCTURE

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
			hovered_key:this.props.hovered_key,
			selected_key:this.props.selected_key,
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
		// console.log(this);
		// console.log(this._isBlockAndHasNoBlockChildren);
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
	 * @param args.rendering_start_path path from which the rendering should start.
	 * (i.e. for html and starting from root : "/html[0]/body[0]/", with a trailing slash at the end to only render the content of the body and not the body itsel).
	 * @param args.hovering_path path from which the rendering should start.
	 */
	computeHtml(args : {
			rendering_start_path:string,
			use_semantic_css?:boolean, 
			hovering_path?:string, 
			selection_path?:string
		}):string 
	{
		if (this.key.startsWith(args.rendering_start_path)){ // Node to render
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
					// everything except classes
					return attr_name !== "class" ? `${attr_name}="${attr.value}"` : "";
				});
				
				attributes_array.push(`id="${this.key}"`);
				
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
				let cssClass = "";
				if( (args.hovering_path ? this.key.startsWith(args.hovering_path) : false) ){
					cssClass += "hovered ";
				}
				if(args.use_semantic_css && this.props.name){
					cssClass += `semantic_${this.props.name.localPart} `;
				}
				if(cssClass.length > 0){
					cssClass = `class="${cssClass}"`;
				}
				attributes_array.push(cssClass);
				// Content of the node and node end
				let content = "";
				let node_end = "";
				if(this.props.children.length > 0){
					content = ">\n";
					for(let i = 0, end = this.props.children.length; i < end; i++){
						content += this.props.children[i].computeHtml({
								rendering_start_path:args.rendering_start_path,
								hovering_path:args.hovering_path,
								selection_path:args.selection_path,
								use_semantic_css:args.use_semantic_css}
							);
					}
					node_end = `</${node_name}>`;
				} else if(this.props.text){
					content = ">\n" + this.props.text;
					node_end = `</${node_name}>`;
				} else {
					content = "";
					node_end = "/>";
				}
				// Reconstruct node 
				let attributes = attributes_array.join(' ');

				// use ${cssInlined} for computed css from the original document
				return `<${node_name} ${attributes.trim()} ${namespaces.trim()}${content}\n${node_end}\n`;
			} else { // anonymous node (more likely to be textual node)
				if(this.props.children.length > 0) {
					return this.props.children.map((b:Box)=>{
							return b.computeHtml({
								rendering_start_path:args.rendering_start_path,
								hovering_path:args.hovering_path,
								selection_path:args.selection_path,
								use_semantic_css:args.use_semantic_css});
						}).join("");
				} else if(this.props.text) {
					return this.props.text;
				} else return "";	
			} 
		} else if(this.props.children.length > 0){
				return this.props.children.map((b:Box)=>{
					return b.computeHtml({
						rendering_start_path:args.rendering_start_path,
						hovering_path:args.hovering_path,
						selection_path:args.selection_path,
						use_semantic_css:args.use_semantic_css});
				}).join("");
		} else return "";
	}

	/**
	 * Compute the React element that can be used in react rendering stage
	 * @param rendering_start_path
	 * @param use_semantic_css
	 * @param hovering_path
	 * @param selection_path
	 */
	computeReactNode(args : {
		rendering_start_path:string,
		use_semantic_css?:boolean, 
		hovering_path?:string, 
		selection_path?:string,
		onMouseEnterCallback?:(hovered_key:string)=>void,
		onMouseLeaveCallback?:(hovered_key:string)=>void,
		onSelectionCallback?:(selected_key:string)=>void
	}):React.FunctionComponentElement<{}> | React.DOMElement<any,Element> | ReactElement<{}>{
		if (this.key.startsWith(args.rendering_start_path)){ // Node to render
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
					// everything except classes
					return attr_name !== "class" ? `"${attr_name}":"${attr.value}"` : "";
				});
				
				attributes_array.push(`"id":"${this.key}"`);
				
				// Adding the node namespace to the map of namespaces
				if(this.props.name && this.props.name.prefix && this.props.name.namespace && !namespaces_map.has(this.props.name.prefix)){
					namespaces_map.set(this.props.name.prefix,this.props.name.namespace);
				}
				// compute namespaces string
				let namespaces = new Array<string>();
				namespaces_map.forEach((namespace:string, prefix:string, map:Map<String,String>) => {
					namespaces.push(`"xmlns:${prefix}":"${namespace}"`);
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
				let cssClasses = new Array<string>();
				if( (args.hovering_path ? this.key.startsWith(args.hovering_path) : false) || this.state.is_hovered ){
					cssClasses.push("hovered");
				}
				if(args.use_semantic_css && this.props.name){
					cssClasses.push(`semantic_${this.props.name.localPart}`);
				}
				if(cssClasses.length > 0){
					attributes_array.push(`"className":"${cssClasses.join(" ")}"`);
				}
				
				//TODO  onmouseenter should always sent back the lowest child
				

				// Content of the node
				let content = [];
				if(this.props.children.length > 0){
					for(let i = 0, end = this.props.children.length; i < end; i++){
						content.push(this.props.children[i].computeReactNode(args));
					}
				} else if(this.props.text){
					content.push(React.createElement(React.Fragment,null,this.props.text))
				}
				
				let attributes = JSON.parse(`{${attributes_array.filter((el=>{return el != "";})).join(',')}}`);
				
				// Adding event callbacks
				if(args.onMouseEnterCallback){
					attributes.onMouseEnter = (()=>{args.onMouseEnterCallback!(this.key)});
				}
				if(args.onMouseEnterCallback){
					attributes.onMouseLeave = (()=>{args.onMouseLeaveCallback!(this.key)});
				}
				if(args.onSelectionCallback){
					attributes.onClick = (() => {args.onSelectionCallback!(this.key)});
				}
				
				// Note : empty array passed to createElement create an empty but not self closing tag
				// -> react raises an error for cases like tag <img></img> is created instead of <img/>
				if(content.length > 0) return React.createElement(node_name,attributes,content);
				else return React.createElement(node_name,attributes);
			} else { // anonymous node (more likely to be textual node)
				if(this.props.children.length > 0) {
					return React.createElement(React.Fragment,null, 
						this.props.children.map((b:Box)=>{
							return b.computeReactNode(args);
						}));
				} else if(this.props.text) {
					return React.createElement(React.Fragment,null,this.props.text);
				} else return React.createElement(React.Fragment); // Empty anonymous node
			} 
		} else if(this.props.children.length > 0){ // anonymous node with children
			return React.createElement(React.Fragment,null, 
				this.props.children.map((b:Box)=>{
					return b.computeReactNode(args);
				}));
		} else return React.createElement(React.Fragment); // Empty anonymous node
	}

	/**
	 * Reconstruct a basic html frame around the box
	 * @param rendering_start_path path from which the html frame start 
	 * 		(element that are not to be rendered when computing the frame)
	 */
	computeIsolatedHtml(
		rendering_start_path:string, 
		use_semantic_css?:boolean
	):string{
		if (this.key.startsWith(rendering_start_path)){
			let html_content = "";
			let tags = this.key.substring(rendering_start_path.length).split('/').slice(1);
			tags = tags.slice(0,tags.length - 1);
			for(let tag of tags){
				tag = tag.split('[')[0];
				let cssClass = use_semantic_css ? ` class="semantic_${tag}"` : "";
				html_content += `<${tag}${cssClass}>`;
			}
			html_content += this.computeHtml({
					rendering_start_path:rendering_start_path, 
					use_semantic_css:use_semantic_css});
			for(let i = tags.length; i--;){
				let tag = tags[i].split('[')[0];
				html_content += `</${tag}>`;
			}
			//console.log(html_content);
			return html_content;
		} else return "";
	}
	
	/**
	 * Reconstruct a basic react node tree around the box react node
	 * @param rendering_start_path path from which the react rendering start 
	 * 		(element that are not to be rendered when computing the box)
	 */
	computeIsolatedReactNode(args : {
		rendering_start_path:string,
		use_semantic_css?:boolean, 
		hovering_path?:string, 
		selection_path?:string,
		onMouseEnterCallback?:(hovered_key:string)=>void,
		onMouseLeaveCallback?:(hovered_key:string)=>void,
		onSelectionCallback?:(selected_key:string)=>void
	}
	):React.FunctionComponentElement<{}> | React.DOMElement<any,Element> | ReactElement<{}>{
		if (this.key.startsWith(args.rendering_start_path)){
			let tags = this.key.substring(args.rendering_start_path.length).split('/').slice(1);
			tags = tags.slice(0,tags.length - 1);
			let stack = [];
			for(let tag of tags){
				tag = tag.split('[')[0];
				stack.push(tag);
			}
			let rendered_node = this.computeReactNode(args);
			while(stack.length > 0 ){
				let tag = stack.pop()!;
				let cssClass = args.use_semantic_css ? `semantic_${tag}` : "";
				
				rendered_node = React.createElement(tag,{
					className:cssClass
				}, rendered_node);
			}
			return rendered_node;
		} else return React.createElement(React.Fragment); // Empty anonymous node
	}
	
	/**
	 * React default rendering function
	 */
	render(){
		return this.renderAsIframe();
	}

	renderAsIframe(){
		
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
			hovered_key: this.props.hovered_key,
			selected_key: this.props.selected_key,
			hide: this.props.virtual,
			render_mode: this.props.render_mode
		};
		rendered_box_props.children = rendered_children;
		let rendered_box = new Box(rendered_box_props);
		rendered_box.key = '/html[0]';

		// recursively compute the html source as a string
		let rendered_content = rendered_box.computeHtml({rendering_start_path:'/',hovering_path:this.props.hovered_key}); 
		//console.log(rendered_content);
		return (<iframe 
			title="html_view"
			//srcDoc={rendered_content} // not compatible with edge and legacy browser
			src={ "data:text/html;charset=utf-8, " + encodeURIComponent(rendered_content)} // + Base64.encodeString(rendered_content)} 
			height="100%" width="100%"
			contentEditable={true} />);
			// */	
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
