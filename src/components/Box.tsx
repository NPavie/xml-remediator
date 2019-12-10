import ListIterator from "./ListIterator";
import ListIterable from "./ListIterable";
import IllegalArgumentException from "./exceptions/IllegalArgumentException";


import QName from './QName';
import Attribute from './Attribute';
import { Properties } from "csstype";
import React, { Fragment } from "react";




import './Box.css';

enum BoxType {
	INLINE,
	BLOCK
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
	cssprops?:Properties
}

export default class Box extends React.Component<BoxInterface> {
    
	public childrenIterable:ListIterable<Box>;
	
	constructor(props:BoxInterface) {
		super(props);
		this.childrenIterable = ListIterable.from<Box>(props.children[Symbol.iterator]())
	}

	get children():ListIterator<Box>{
		return this.childrenIterable[Symbol.iterator]() as ListIterator<Box>;
	}

	protected copy():Box{
		let newBox = new Box(this.props);
		newBox.childrenIterable = this.childrenIterable;
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
				if (c.props.type === BoxType.BLOCK && c.props.name == null && prevIsAnonymous === true)
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

	render(){
		// display the node data on the left
		// if the node has text, display it on the right
		// else dont display anything
		let idkey = 0;
		let attributesRendering = this.props.attributes.map<JSX.Element>((attr:Attribute) => {
			return <div><span key={idkey++} className="box__attr">@{attr.name.localPart}: {attr.value} </span><br/></div>
		});

		
		return (
			<Fragment>
				<tr>
					<td className="box__data">
						{this.props.type === BoxType.BLOCK ? "Block" : "Inline"} {this.props.name ? this.props.name.localPart : "Text"} <br/>
						{attributesRendering}
					</td>
					<td className="box__content">{this.props.text}</td>
				</tr>
				{this.props.children.map((b:Box) => {return b.render()})}
			</Fragment>
			);
	}

	static parse(jsonString:string){
		let box = new Box(JSON.parse(
				jsonString,
				(key:any, value:any) => {
					if (key === 'children')
						return value.map((v:BoxInterface) => {
							var box = new Box(v);
							Object.freeze(box);
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
		Object.freeze(box);
		return box;
	}
}