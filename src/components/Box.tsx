/**
 * Box document model
 * 
 */

import ListIterator from "./ListIterator";
import ListIterable from "./ListIterable";
import IllegalArgumentException from "./exceptions/IllegalArgumentException";


import QName from './QName';
import Attribute from './Attribute';
import { Properties } from "csstype";
import React, { ReactElement } from "react";


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
 * Boxes mod of html rendering : 
 * - HTML : render the content as html with original computed css properties
 * - SEMANTIC : render the content as html with semantic css classes
 */
export enum ContentCSS{
	DEFAULT,
	SEMANTIC
};

/**
 * 
 */
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
 * @param {ContentCSS | undefined} render_mode 
 */
export interface BoxInterface {
	type:BoxType,
	name?:QName | null,
	attributes:Array<Attribute>,
	text?:string,
	isReplacedElement:boolean,
	children:Array<Box>,
	cssprops?:Properties,
	parent_key?:string,
	parent_index?:number,
	hovered_keys?:Array<string>,
	selected_keys?:Array<string>,
	virtual?:boolean,
	rendering_css?:ContentCSS
}


/**
 * 
 */
export class Box extends React.Component<BoxInterface, BoxState> {
    
	public childrenList:ListIterable<Box>;	
	public key:string = "";
	public rendering:Rendering = Rendering.DEFAULT;

	
	private static IMG:QName = new QName({namespace:"http://www.w3.org/1999/xhtml",localPart:"img"});


	/**
	 * Create a Box object from a json BoxInterface object
	 * @param {BoxInterface} props 
	 */
	constructor(props:BoxInterface) {
		super(props);
		//this.children = ListIterable.from<Box>(this.props.children[Symbol.iterator]());
		this.childrenList = new ListIterable(this.props.children[Symbol.iterator]())
		let local_name = props.name ? props.name.localPart :
			props.text ? "text()" : "_"; 
		let path = (props.parent_key ? props.parent_key : "") + "/"+ local_name;
		this.key = path + (props.parent_index ? `[${props.parent_index}]` : "[0]");
		
		this.state = {
			is_selected: props.selected_keys != null ? this.isInKeyList(props.selected_keys) : false,
			is_focused:false,
			is_hovered:props.hovered_keys != null ? this.isInKeyList(props.hovered_keys) : false 
		};
	}

	public static AnonymousBlockBox(children:Array<Box>){
		return new Box({
			type:BoxType.BLOCK,
			attributes:[],
			isReplacedElement:true,
			children:children
		})
	}

	public static AnonymousInlineBox(children:Array<Box>){
		return new Box({
			type:BoxType.INLINE,
			attributes:[],
			isReplacedElement:true,
			children:children
		})
	}

	//// BOX STRUCTURE

	get children(){
		return this.childrenList[Symbol.iterator]() as ListIterator<Box>;
	}

	/**
	 * Prepare a BoxInterface copy of the current box, with empty children and attributes
	 */
	protected preparePropsCopy():BoxInterface{
		return {
			attributes:new Array<Attribute>(),
			children:new Array<Box>(),
			type:this.props.type,
			name:this.props.name,
			text:this.props.text,
			isReplacedElement:this.props.isReplacedElement,
			cssprops:this.props.cssprops,
			parent_key:this.props.parent_key,
			parent_index:this.props.parent_index,
			hovered_keys:this.props.hovered_keys,
			selected_keys:this.props.selected_keys,
			virtual:this.props.virtual,
			rendering_css:this.props.rendering_css
		} as BoxInterface;
	}

	public copy(
			with_new: {
				name?:QName | null, 
				attributes?:Map<QName,string> | null, 
				children?:ListIterator<Box>|Array<Box>, 
				rendering?:Rendering,
				// for key propagation
				parent_key?:string, 
				parent_index?:number
			} = { /* default with empty new_props */ }
	):Box{
		// create a basic props copy with no children or attributes (empty arrays)
		let new_props:BoxInterface = this.preparePropsCopy();
		let current_key = this.key;
		let keys = this.key.split('/');
		// just in case
		new_props.parent_index = Number.parseInt(keys[keys.length - 1].split('[')[1].split(']')[0]);
		new_props.parent_key = keys.slice(0,keys.length - 1).join('/');

		if(with_new.name === null){ // request for the name to be deleted
			new_props.name = with_new.name;
			current_key = `${new_props.parent_key}/_[${new_props.parent_index}]`;
		} else if(with_new.name !== undefined) { // renaming the node if requested
			new_props.name = with_new.name;
			current_key = `${new_props.parent_key}/${new_props.name.localPart}[${new_props.parent_index}]`;
		}
		if(with_new.parent_key != null){
			new_props.parent_key = with_new.parent_key;
		}
		if(with_new.parent_index != null){
			new_props.parent_index = with_new.parent_index;
		}

		if(with_new.attributes === null){ // request for the attributes to be deleted
			new_props.attributes = new Array<Attribute>(); // empty attribute array
		} else if(with_new.attributes !== undefined){ // stash new attributes
			new_props.attributes = new Array<Attribute>();
			with_new.attributes.forEach((val:string,key:QName)=>{
				new_props.attributes.push({name:key, value:val} as Attribute);
			});
		} else { // copy of the attributes
			this.props.attributes.forEach((attr:Attribute) => {
				new_props.attributes.push(attr);
			});
		}
		// select the iterator to copy the children from
		let children_to_copy = with_new.children != null ? with_new.children : this.children;
		let i = 0;
		for(let child of children_to_copy){
			let copy = child.copy();
			copy.updateKeys(current_key,i);
			new_props.children.push(copy);
			++i;
		}
		
		let newBox = new Box(new_props);
		newBox.rendering = (with_new.rendering != null) ? with_new.rendering : this.rendering;
		newBox._hasText = this._hasText;
		newBox._isBlockAndHasNoBlockChildren = this._isBlockAndHasNoBlockChildren;

		// tree coherence check when new children are given
		if(with_new.children != null){
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
		}
		// update children keys
		//i = 0;
		//for(let child of newBox.children){
		//	//console.log(child);
		//	child.updateKeys(newBox.key,i);
		//	i++;
		//}
		return newBox;
	}	

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
		return this.props.isReplacedElement || (this.props.name ? this.props.name.equals(Box.IMG) : false);
	}

	private _hasText?:boolean;
	hasText():boolean{
		if(this._hasText == null){
			this._hasText = (this.props.type === BoxType.INLINE && this.props.text != null && this.props.text !== "");
		}
		return this._hasText!;
	}

	isAnonymous(){
		return this.getName() == null || this.rendering === Rendering.ANONYMOUS;
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


	/** REACT RENDERING SECTION */

	/**
	 * #TODO update computeHtml method (sync with computeReactNode)
	 * - 
	 * Reconstruct the box hierarchy as xml within a string.
	 * @param args.rendering_start_path path from which the rendering should start.
	 * (i.e. for html and starting from root : "/html[0]/body[0]/", with a trailing slash at the end to only render the content of the body and not the body itsel).
	 * @param args.hovering_path path from which the rendering should start.
	 */
	computeHtml(args : {
			rendering_start_path:string,
			use_semantic_css?:boolean, 
			hovering_pathes?:Array<string>, 
			selection_pathes?:Array<string>
	}):string {
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
				if( (args.hovering_pathes ? this.isInKeyList(args.hovering_pathes) : false) ){
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
				if(!this.childrenList.isEmpty()){
					content = ">\n";
					for(let child of this.children){
						content += child.computeHtml({
							rendering_start_path:args.rendering_start_path,
							hovering_pathes:args.hovering_pathes,
							selection_pathes:args.selection_pathes,
							use_semantic_css:args.use_semantic_css}
						);
					}/*
					for(let i = 0, end = this.props.children.length; i < end; i++){
						content += this.props.children[i].computeHtml({
								rendering_start_path:args.rendering_start_path,
								hovering_path:args.hovering_path,
								selection_path:args.selection_path,
								use_semantic_css:args.use_semantic_css}
							);
					}*/
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
				if(!this.childrenList.isEmpty()){
					let content = "";
					for(let child of this.children){
						content += child.computeHtml({
							rendering_start_path:args.rendering_start_path,
							hovering_pathes:args.hovering_pathes,
							selection_pathes:args.selection_pathes,
							use_semantic_css:args.use_semantic_css});
					}
					return content;
					// return this.props.children.map((b:Box)=>{
					// 		return b.computeHtml({
					// 			rendering_start_path:args.rendering_start_path,
					// 			hovering_path:args.hovering_path,
					// 			selection_path:args.selection_path,
					// 			use_semantic_css:args.use_semantic_css});
					// 	}).join("");
				} else if(this.props.text) {
					return this.props.text;
				} else return "";	
			} 
		} else if(this.props.children.length > 0){
				return this.props.children.map((b:Box)=>{
					return b.computeHtml({
						rendering_start_path:args.rendering_start_path,
						hovering_pathes:args.hovering_pathes,
						selection_pathes:args.selection_pathes,
						use_semantic_css:args.use_semantic_css});
				}).join("");
		} else return "";
	}

	/**
	 * Compute the React element that can be used in react rendering stage
	 * @param rendering_start_path
	 * @param use_semantic_css
	 * @param hovering_pathes
	 * @param selection_pathes
	 */
	computeReactNode(args : {
		rendering_start_path:string,
		use_semantic_css?:boolean, 
		hovering_pathes?:Array<string>, 
		selection_pathes?:Array<string>,
		onMouseEnterCallback?:(hovered_key:string)=>void,
		onMouseLeaveCallback?:(hovered_key:string)=>void,
		onSelectionCallback?:(selected_key:string)=>void
	}):React.FunctionComponentElement<{}> | React.DOMElement<any,Element> | ReactElement<{}>{
		if (this.key.startsWith(args.rendering_start_path) && this.rendering === Rendering.DEFAULT){ // Node to render
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
				if( (args.hovering_pathes ? this.isInKeyList(args.hovering_pathes) : false) || this.state.is_hovered ){
					cssClasses.push("hovered");
				}
				if(args.use_semantic_css && this.props.name){
					cssClasses.push(`semantic_${this.props.name.localPart}`);
				}
				if(cssClasses.length > 0){
					attributes_array.push(`"className":"${cssClasses.join(" ")}"`);
				}
				
				
				// Content of the node
				let content = [];
				if(this.props.children.length > 0){
					for(let i = 0, end = this.props.children.length; i < end; i++){
						content.push(this.props.children[i].computeReactNode(args));
					}
				} else if(this.props.text){
					content.push(React.createElement(React.Fragment,null,this.props.text))
				}
				
				let attributes = JSON.parse(`{${attributes_array.filter((el=>{return el !== "";})).join(',')}}`);
				
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
		} else if(this.props.children.length > 0 && this.rendering !== Rendering.SKIP){ // anonymous node with children
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
	computeIsolatedReactNode(
			args : {
				rendering_start_path:string,
				use_semantic_css?:boolean, 
				hovering_pathes?:Array<string>, 
				selection_pathes?:Array<string>,
				onMouseEnterCallback?:(hovered_key:string)=>void,
				onMouseLeaveCallback?:(hovered_key:string)=>void,
				onSelectionCallback?:(selected_key:string)=>void
			}
	):React.FunctionComponentElement<{}> | React.DOMElement<any,Element> | ReactElement<{}>{
		if (this.key.startsWith(args.rendering_start_path)){
			let keys = this.key.substring(args.rendering_start_path.length).split('/').slice(1);
			keys = keys.slice(0,keys.length - 1);
			let stack = [];
			for(let key of keys){
				stack.push(key);
				
			}
			let rendered_node = this.computeReactNode(args);
			while(stack.length > 0 ){
				let key = stack.pop()!;
				let tag = key.split('[')[0];
				// recomputed complete node key
				key = args.rendering_start_path + "/" + stack.join('/') + key;
				let css_classes = new Array<string>();
				if(args.use_semantic_css) css_classes.push(`semantic_${tag}`);
				// check if the element is in the hovered keys
				if(args.hovering_pathes != null && Box.keyIsInList(key,args.hovering_pathes)){
					css_classes.push("hovered");
				}
				// TODO : selection test for css class

				let cssClass = css_classes.join(" ");
				
				let attributes:any = {};
				attributes.className = cssClass;
				attributes.id = key;
				// Adding event callbacks
				if(args.onMouseEnterCallback){
					attributes.onMouseEnter = (()=>{args.onMouseEnterCallback!(key)});
				}
				if(args.onMouseEnterCallback){
					attributes.onMouseLeave = (()=>{args.onMouseLeaveCallback!(key)});
				}
				if(args.onSelectionCallback){
					attributes.onClick = (() => {args.onSelectionCallback!(key)});
				}

				rendered_node = React.createElement(tag,attributes, rendered_node);
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
		//console.log(rendered_children);
		// new css style tag
		let css = new Box({
			text:this.props.rendering_css === ContentCSS.DEFAULT ? html4 : html5_semantic_css,
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
			hovered_key: this.props.hovered_keys,
			selected_key: this.props.selected_keys,
			hide: this.props.virtual,
			render_mode: this.props.rendering_css
		};
		rendered_box_props.children = rendered_children;
		let rendered_box = new Box(rendered_box_props);
		rendered_box.key = '/html[0]';

		// recursively compute the html source as a string
		let rendered_content = rendered_box.computeHtml({rendering_start_path:'/',hovering_pathes:this.props.hovered_keys}); 
		
		//console.log(rendered_content);
		return (<iframe 
			title="html_view"
			//srcDoc={rendered_content} // not compatible with edge and legacy browser
			src={ "data:text/html;charset=utf-8, " + encodeURIComponent(rendered_content)}
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
				|| (key.startsWith(this.key) && key.length - this.key.length <= 3) ){
			// => if its an incomplete key like /html[0]/hea[0]/style 
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
	 * Recompute the keys of the boxtree
	 * @param parent_key current parent key
	 * @param index current index of the box within its parent children list
	 */
	updateKeys(parent_key?:string, index:number = 0){
		this.key = `${parent_key != null ? parent_key : ""}/${(this.props.name != null ? this.props.name.localPart : "text()")}[${index}]`;
		let i = 0
		for(let child of this.children){
			child.updateKeys(this.key, i);
			i++
		}

		//for(let i = this.props.children.length; i--;){
		//	this.props.children[i].updateKeys(this.key, i);
		//	//Object.freeze(this.props.children[i]);
		//}
	}

	/**
	 * reconstruct a box object from a serialized one
	 * @param json_box the serialized box object
	 */
	static parse(json_box:string):Box{
		let box = new Box(JSON.parse(
				json_box,
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

	/**
	 * Retrieve the keys of the box and all its descendants
	 * @param existing_keys keys array reference. if not defined, a new one is created and return
	 */
	getKeys(existing_keys?:Array<string>):Array<string>{
		let keys_array = existing_keys != null ? existing_keys : new Array<string>();
		keys_array.push(this.key);
		for(let child of this.children){
			keys_array = child.getKeys(keys_array);
		}
		return keys_array;
	}

	/**
	 * Check if the box key is within a specified list of keys.
	 * Beware that the key is considered to be in the list if its key or an ancestor's one is in the list.
	 * @param keys_list 
	 */
	isInKeyList(keys_list:Array<string>):boolean{
		return Box.keyIsInList(this.key,keys_list);
	}
	
	/**
	 * (Utility function) Check if a key is in a list
	 * @param searched_key 
	 * @param keys_list 
	 */
	static keyIsInList(searched_key:string,keys_list:Array<string>):boolean{
		for(let key of keys_list){
			if(searched_key.startsWith(key)){ 
				return true;
			}
		}
		return false;
	}

}
