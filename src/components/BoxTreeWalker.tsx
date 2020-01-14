import ConcurrentModificationException from './exceptions/ConcurrentModificationException';
import ListIterator from './ListIterator';
import QName from './QName';
import CanNotPerformTransformationException from './exceptions/CanNotPerformTransformationException';

import { Box, Rendering } from './Box';
import Optional from './Optional';

import NoSuchElementException from './exceptions/NoSuchElementException';
import CanNotDoWalkerActionException from './exceptions/CanNotDoWalkerActionException';


function deepCopyStack(stack:Array<ListIterator<Box>>) {
	return stack.map(iterable => iterable.clone());
}


var noSuchElement = Optional.empty<Box>();

/**
 * names
 */
export class BoxFilter{
	/** Box selection filters */
	static isBlockAndHasNoBlockChildren(b?:Box){
		return b ? b.isBlockAndHasNoBlockChildren() : true;
	}

	static isReplacedElementOrTextBox(b?: Box) {
		return b ? b.props.text != null || b.props.isReplacedElement : true;
	}
}

export default class BoxTreeWalker {
	
	_root: Box;
	private _current: Box;

    path: Array<ListIterator<Box>>;
	
	
	// For subtrees
	private _full_tree?:BoxTreeWalker;

	static assertThat(test:boolean,message?:string) {
		if (!test) throw new CanNotDoWalkerActionException(message);
	}
    
	constructor(root:Box, updateRootCallback?:((newroot:Box)=>void),full_tree?:BoxTreeWalker) {
		this._root = root;
		this.path = [];
        this._current = root;
		if(updateRootCallback) this.updateRoot = updateRootCallback.bind(this);
		this._full_tree = full_tree;
	}
    
    clone():BoxTreeWalker {
        let clone = new BoxTreeWalker(this._root);
		clone.path = deepCopyStack(this.path);
        clone._current = this._current;
        return clone;
	}
	
	
	subTree():BoxTreeWalker {
		if (this.path.length == 0)
            return this;
		
		return this.path.length === 0 ? 
			this : 
			new BoxTreeWalker(
					this._current, 
					((root:Box) => {
						if (this._root != this._full_tree!.current())
							throw new ConcurrentModificationException();
						else {
							this._root = root;
							this._full_tree!.updateCurrent(root);
						}
				}), this);
	}
	
	current() : Box {
		return this._current;
	}

	/**
	 * Reset the walker to the root of the tree and returns the current (root) box
	 */
	root() : Box {
		while (this.parent().isPresent());
		return this._current;
	}

	previousSibling() : Optional<Box> {
		if (this.path.length === 0) return noSuchElement;
		else {
			let siblings = this.path[this.path.length - 1];
			siblings.previous();
			if (!siblings.hasPrevious()) {
				siblings.next();
				return noSuchElement;
			} else {
				this._current = siblings.previous().value;
				siblings.next();
				return Optional.of(this._current);
			}
		}
	}
    
    nextSibling() : Optional<Box> {
		if (this.path.length == 0) return noSuchElement;
		else {
			let siblings = this.path[this.path.length - 1];
			if (!siblings.hasNext()) return noSuchElement;
			else {	
				this._current = siblings.next().value;
				return Optional.of(this._current);
			}
		}
		
	}
	
	
	parent() : Optional<Box> {
		if (this.path.length == 0) return noSuchElement;
		else {
			this.path.pop();
			if (this.path.length == 0) this._current = this._root;
			else {
				let peek = this.path[this.path.length - 1];
				this._current = peek.previous().value;
				peek.next();
			}
			return Optional.of(this._current);
		}
		
	}
	
	
    firstChild() : Optional<Box> {
		let children = this._current.children;
		if (!children.hasNext()) return noSuchElement;
		else {
			this._current = children.next().value;
			this.path.push(children);
			return Optional.of(this._current);
		}
    }
    /**
	 * 
	 * @param filter 
	 */
	firstFollowing(filter?:(node?:Box)=>boolean) : Optional<Box>{
		if (filter) { // firstFollowing(Predicate<Box> filter) signature
			let savePath = deepCopyStack(this.path);
			let saveCurrent = this._current;
			let next:Optional<Box> = Optional.empty<Box>();
			console.log(this);
			while(true){
				next = this.firstFollowing();
				if(next.isPresent()){
					if(filter(next.value)){
						return next;
					} else {
						next = this.firstDescendant(filter);
						if(next.isPresent()){
							return next;
						}
					}
				} else break;
			}
			this.path = savePath;
			this._current = saveCurrent;
			return noSuchElement;	
		} else { // firstFollowing() signature
			for (let i = this.path.length - 1; i >= 0 ; i--) {
				let siblings = this.path[i];
				if (siblings.hasNext()) {
					this._current = siblings.next().value;
					this.path.length = i + 1;
					return Optional.of(this._current);
				}
			}
			return noSuchElement;
		}
	}

	firstPreceding(filter?:(node?:Box)=>boolean) : Optional<Box> {
		if(filter){
			let savePath = deepCopyStack(this.path);
			let saveCurrent = this._current;
			let previous;
			if (!(previous = this.firstPreceding()).done) {
				if (filter(previous.value))
					return previous;
				else
					while (true) {
						if (!(previous = this.previousSibling()).done) {
							while (true)
								if (!(previous = this.firstChild()).done) {
									if (!(previous = this.nextSibling()).done)
										while (!(previous = this.nextSibling()).done);
								} else
									break;
						} else {
							previous = this.parent();
							if (previous.done)
								break;
						}
						if (filter(previous.value))
							return previous;
					}
			}
			this.path = savePath;
			this._current = saveCurrent;
			return noSuchElement;
		} else { // firstPreceding() signature
			for (let i = this.path.length - 1; i >= 0 ; i--) {
				let siblings = this.path[i];
				siblings.previous();
				if (siblings.hasPrevious()) {
					this._current = siblings.previous().value;
					siblings.next();
					this.path.length = i + 1;
					while (true) {
						let children = this._current.children;
						if (children.hasNext()) {
							while (children.hasNext()) {
								this._current = children.next().value;
								this.path.push(children);
							}
						} else break;
					}
					return Optional.of(this._current);
				} else siblings.next();
			}
			return noSuchElement;
		}
	}

	firstParent(filter:(node?:Box)=>boolean) : Optional<Box> {
		for (let i = this.path.length - 2; i >= 0 ; i--) {
			let parent = this.path[i].previous().value;
			this.path[i].next();
			if (filter(parent)) {
				this.path.length = i + 1;
				this._current = parent;
				return Optional.of(this._current);
			}
		}
		if (filter(this._root)) {
			this.path.length = 0;
			this._current = this._root;
			return Optional.of(this._current);
		} else return noSuchElement;
	}

	firstDescendant(filter:(node?:Box)=>boolean) : Optional<Box> {
		let startDepth = this.path.length;
		while (true) {
			let next = this.firstChild();
			if(!next.isPresent()){
				if(this.path.length === startDepth){
					return noSuchElement;
				} else {
					next = this.nextSibling();
					if(!next.isPresent()){

					}
				}
			}
			if (!(!(next = this.firstChild()).done || this.path.length > startDepth && !(next = this.nextSibling()).done))
				while (true)
					if (!(next = this.parent()).done) {
						if (this.path.length == startDepth)
							return noSuchElement;
						if (!(next = this.nextSibling()).done)
							break;
					} else
						break;
			if (!next.done) {
				if (filter && filter(next.value)) return next;
			} else
				break;
		}
		return noSuchElement;
    }
    
	renameCurrent(name:QName, attributes?:Map<QName,string>) {
		let renamed = this._current.copy({name:name,attributes:attributes});
		this.updateCurrent(renamed);
		return this._current;
    }
    
	deleteFirstChild() {
		let children = this._current.children;
		if (!children.hasNext())
			throw new NoSuchElementException("there is no first child");
		children.next();
		this.updateCurrent(this._current.withChildren(children));
		return this._current;
	}

	unwrapFirstChild() {
		let children = this._current.children;
		if (!children.hasNext())
			throw new NoSuchElementException("there is no first child");
		let firstChild = children.next().value;
		children.previous();
		let children_array = children.consume();
		if (firstChild.text != null)
			children_array[0] = firstChild.withName(null);
		else
			children_array = firstChild.children.consume().concat(children_array.slice(1));
		this.updateCurrent(this._current.withChildren(children_array));
		return this._current;
	}

	unwrapNextSibling() {
		if (this.path.length == 0)
			throw new NoSuchElementException("there is no next sibling");
		let siblings = this.path[this.path.length - 1];
		if (!siblings.hasNext())
			throw new NoSuchElementException("there is no next sibling");
		let parent = this.parent().value;
		let nextSibling = siblings.next().value;
		let i = siblings.rewind();
		let siblings_array = siblings.consume();
		if (nextSibling.text != null)
			siblings_array[i - 1] = nextSibling.withName(null);
		else
			siblings_array = siblings_array.slice(0, i - 1).concat(nextSibling.children.consume()).concat(siblings_array.slice(i));
		this.updateCurrent(parent!.withChildren(siblings_array));
		this.firstChild();
		while (i-- > 2) this.nextSibling();
		return this._current;
	}
	unwrapParent() {
		if (this.path.length == 0)
			throw new NoSuchElementException("there is no parent");
		if (this.path.length == 1)
			throw new CanNotDoWalkerActionException("root can not be unwrapped");
		let siblings = this.path[this.path.length - 1];
		this.parent();
		let parentSiblings = this.path[this.path.length - 1];
		let i = BoxTreeWalker.rewind(siblings);
		let j = BoxTreeWalker.rewind(parentSiblings);
		let parentSiblings_array = parentSiblings.consume();
		parentSiblings_array = parentSiblings_array.slice(0, j - 1).concat(siblings.consume()).concat(parentSiblings_array.slice(j));
		let newParent = this.parent().value;
		if(newParent)
			this.updateCurrent(newParent.withChildren(parentSiblings_array));
		this.firstChild();
		while (i-- > 1) this.nextSibling();
		while (j-- > 1) this.nextSibling();
		return this._current;
	}
    
    protected updateRoot(newRoot:Box) {
		this._root = newRoot;
	}
    
    
    updateCurrent(newCurrent:Box) {
		if (this.path.length == 0)
			this.updateRoot(newCurrent);
		else {
			let newPath = [];
			let cur = newCurrent;
			while (this.path.length > 0) {
				let siblings = this.path[this.path.length - 1];
				let parent = this.parent().value;
				let i = BoxTreeWalker.rewind(siblings);
				let siblings_array = siblings.consume();
				siblings_array[i - 1] = cur;
				cur = parent!.withChildren(siblings_array);
				siblings = cur.children;
				siblings.forward( i);
				newPath.unshift(siblings);
			}
			this.updateRoot(cur);
			this.path = newPath;
		}
		this._current = newCurrent;
	}


	nthBlock(index:number) {
		BoxTreeWalker.assertThat(!this.firstDescendant(BoxFilter.isBlockAndHasNoBlockChildren).done);
		for (let i = 0; i < index; i++)
			BoxTreeWalker.assertThat(!this.firstFollowing(BoxFilter.isBlockAndHasNoBlockChildren).done);
	}

	nthReplacedElementOrTextBox(index: number) {
		BoxTreeWalker.assertThat(!this.firstDescendant(BoxFilter.isReplacedElementOrTextBox).done);
		for (let i = 0; i < index; i++)
			BoxTreeWalker.assertThat(!this.firstFollowing(BoxFilter.isReplacedElementOrTextBox).done);
	}

	static count(tree:BoxTreeWalker, filter:(b?:Box)=>boolean) {
		var count = 0;
		while (!tree.firstDescendant(filter).done || !tree.firstFollowing(filter).done)
			count++;
		return count;
	}

	count(filter:(b?:Box)=>boolean) {
		return BoxTreeWalker.count(this,filter);
	}

	transformSingleRowTable(firstBlockIdx:number, blockCount:number) : BoxTreeWalker {
		this.root();
		this.nthBlock(firstBlockIdx);
		while (true) {
			BoxTreeWalker.assertThat(this.previousSibling().done);
			let testedProps = this._current.props.cssprops;
			if ( testedProps && testedProps.display == "table-cell")
				break;
			else {
				BoxTreeWalker.assertThat(!(testedProps && testedProps.display === "block"));
				BoxTreeWalker.assertThat(!this.parent().done);
			}
		}
		this.renameCurrent(BoxTreeWalker.DIV);
		BoxTreeWalker.assertThat(this.previousSibling().done);
		while (true) {
			if (!this.nextSibling().done) {
				let testedProps = this._current.props.cssprops;
				BoxTreeWalker.assertThat((testedProps && testedProps.display == "table-cell") || false);
				this.renameCurrent(BoxTreeWalker.DIV);
			} else
				break;
		}
		BoxTreeWalker.assertThat(!this.parent().done);
		//BoxTreeWalker.assertThat(this._current.props.cssprops && this._current.props.cssprops.display == "table-row");
		this.renameCurrent(BoxTreeWalker.DIV);
		BoxTreeWalker.assertThat(this.nextSibling().done);
		BoxTreeWalker.assertThat(this.previousSibling().done);
		BoxTreeWalker.assertThat(!this.parent().done);
		if (true) { // this._current.props.cssprops && this._current.props.cssprops.display == "table-row-group"
			BoxTreeWalker.assertThat(this.nextSibling().done);
			BoxTreeWalker.assertThat(this.previousSibling().done);
			BoxTreeWalker.assertThat(!this.parent().done);
		}
		//BoxTreeWalker.assertThat(this._current.props.cssprops && this._current.props.cssprops.display == "table");
		this.firstChild();
		this.unwrapParent();
		let table = this.subTree();
		BoxTreeWalker.assertThat(BoxTreeWalker.count(table, BoxFilter.isBlockAndHasNoBlockChildren) == blockCount);
		return this;
	}

	markupHeading(firstBlockIdx: number, blockCount: number) : BoxTreeWalker {
		let doc: BoxTreeWalker = this;
		this.root();
		this.nthBlock(firstBlockIdx);
		// find ancestor that contains the specified number of blocks
		while (true) {
			let tmp: BoxTreeWalker = doc.clone();
			if (tmp.previousSibling().done
				&& !tmp.parent().done
				&& BoxTreeWalker.count(tmp, BoxFilter.isBlockAndHasNoBlockChildren) <= blockCount) {
				doc = tmp;
			} else {
				BoxTreeWalker.assertThat(BoxTreeWalker.count(doc, BoxFilter.isBlockAndHasNoBlockChildren) == blockCount);
				break;
			}
		}
		doc.renameCurrent(BoxTreeWalker.H1);
		// remove all strong within the heading
		let h1Walker: BoxTreeWalker = doc.subTree();
		let isStrong: (node?: Box) => boolean = b => b ? BoxTreeWalker.STRONG == b.props.name : true;
		while (!h1Walker.firstDescendant(isStrong).done || !h1Walker.firstFollowing(isStrong).done)
			if (!h1Walker.previousSibling().done)
				h1Walker.unwrapNextSibling();
			else if (!h1Walker.parent().done)
				h1Walker.unwrapFirstChild();
			else
				throw new Error("coding error");
		// remove all div within the heading
		h1Walker.root();
		let isDiv: (node?: Box) => boolean = b => b ? BoxTreeWalker.DIV == b.props.name : true;
		while (!h1Walker.firstDescendant(isDiv).done || !h1Walker.firstFollowing(isDiv).done)
			h1Walker.renameCurrent(BoxTreeWalker._SPAN);
		return doc;
	}

	removeImage(blockIdx: number, inlineIdx: number) : BoxTreeWalker {
		this.root();
		this.nthBlock(blockIdx);
		if (inlineIdx >= 0) {
			BoxTreeWalker.assertThat(inlineIdx < this.count(BoxFilter.isReplacedElementOrTextBox));
			this.nthReplacedElementOrTextBox(inlineIdx);
		}
		BoxTreeWalker.assertThat(BoxTreeWalker.IMG == this._current.props.name);
		BoxTreeWalker.assertThat(this._current.props.isReplacedElement);
		this.renameCurrent(BoxTreeWalker._SPAN);
		return this;
	}


	static IMG: QName = new QName({
		namespace: "http://www.w3.org/1999/xhtml",
		localPart: "img",
		prefix: ""
	});

	static H1: QName = new QName({
		namespace: "http://www.w3.org/1999/xhtml",
		localPart: "h1",
		prefix: ""
	});

	static STRONG: QName = new QName({
		namespace: "http://www.w3.org/1999/xhtml",
		localPart: "strong",
		prefix: ""
	});

	static _SPAN: QName = new QName({
		namespace: "http://www.w3.org/1999/xhtml",
		localPart: "_span",
		prefix: ""
	});

	static DIV:QName = new QName({
        namespace: "http://www.w3.org/1999/xhtml",
        localPart: "div",
        prefix: ""
	});
	

	// unwrap at the rendering stage if possible (if preserveStyle option allows it and block
	// structure can be preserved)
	public markCurrentForUnwrap() {
		let marked = this._current.copy({rendering:Rendering.ANONYMOUS});
		this.updateCurrent(marked);
		return this._current;
	}

	// remove at the rendering stage
	public markCurrentForRemoval() {
		let marked = this._current.copy({rendering:Rendering.SKIP});;
		this.updateCurrent(marked);
		return this._current;
	}

	public wrapCurrent(wrapper:QName, attributes?:Map<QName,string>) {
		let parent = this.clone().parent().orElse(undefined);
		let newBox = this._current.copy();
		if (wrapper != null || attributes != null)
			newBox = newBox.copy({name:wrapper, attributes:attributes});
		this.updateCurrent(newBox);
		this.firstChild();
		return this._current;
	}

	public wrapChildren(wrapper:QName, attributes?:Map<QName,String> ) {
		return this.wrapFirstChildren(-1, wrapper);
	}

	public wrapFirstChildren(childrenCount:number, wrapper:QName, attributes?:Map<QName,string>) {
		let parent = this._current;
		let children;
		let childrenToWrap = new Array<Box>();
		if (childrenCount < 0) {
			if (this.firstChild().isPresent()) {
				children = this.path[this.path.length - 1];
				childrenToWrap.push(this._current);
				while (children.hasNext())
					childrenToWrap.push(children.next().value);
			} else
				children = new ListIterator<Box>({supplier:new Array<Box>()[Symbol.iterator]()});
		} else {
			if (!this.firstChild().isPresent())
				throw new NoSuchElementException("there are no children");
			children = this.path[this.path.length - 1];
			childrenToWrap.push(this._current);
			for (let i = 1; i < childrenCount; i++)
				if (!children.hasNext())
					throw new NoSuchElementException("there are no " + childrenCount + " children");
				else
					childrenToWrap.push(children.next().value);
		}
		let newBox = childrenToWrap[0];
		//instanceof Box.BlockBox
		//	? new Box.AnonymousBlockBox((Box.BlockBox)parent, _b -> childrenToWrap.iterator()::next)
		//	: new Box.InlineBox(null, parent, _b -> childrenToWrap.iterator()::next);
		if (wrapper != null || attributes != null)
			newBox = newBox.copy({name:wrapper, attributes:attributes});
		BoxTreeWalker.rewind(children);
		this.parent();
		this.updateCurrent(
			this._current.copy(
				{children: BoxTreeWalker.updateChildIn(children, 0, childrenToWrap.length, newBox)}));
		return this._current;
	}


	private static rewind(iterator:ListIterator<Box>) {
		let i = 0;
		while (iterator.hasPrevious()) {
			iterator.previous();
			i++;
		}
		return i;
	}

	private static updateChildIn(children:ListIterator<Box>, fromIndex:number, toIndex:number, newChild:Box) {
		// Reconstruct the array
		let newArray = new Array<Box>();
		let i = 0;
		while(children.hasNext()){
			if(i++ === fromIndex){
				if(fromIndex < toIndex) children.next();
				while (i++ < toIndex) children.next();
				newArray.push(newChild);
			} else {
				newArray.push(children.next().value);
			}

		}
		return new ListIterator<Box>({supplier:newArray[Symbol.iterator]()});
	}

	public wrapNextSiblings(siblingCount:number, wrapper:QName, attributes?:Map<QName,string> ) {
		if (this.path.length === 0)
			throw new NoSuchElementException("there are no next siblings");
		let siblings = this.path[this.parent.length - 1];
		let parent = this.parent().value;
		let siblingsToWrap = new Array<Box>();
		for (let i = 0; i < siblingCount; i++)
			if (!siblings.hasNext())
				throw new NoSuchElementException("there are no " + siblingCount + " next siblings");
			else
				siblingsToWrap.push(siblings.next().value);
		let first = BoxTreeWalker.rewind(siblings) - siblingCount;
		let newBox = siblingsToWrap[0] 
			//instanceof Box.BlockBox
			//? new Box.AnonymousBlockBox((Box.BlockBox)parent, _b -> siblingsToWrap.iterator()::next)
			//: new Box.InlineBox(null, parent, _b -> siblingsToWrap.iterator()::next);
		if (wrapper || attributes)
			newBox = newBox.copy({name:wrapper, attributes:attributes});
		this.updateCurrent(this._current.copy({children:BoxTreeWalker.updateChildIn(siblings, first, first + siblingCount, newBox)}));
		this.firstChild();
		while (first-- > 1) this.nextSibling();
		return this._current;
	}

	private static forward(iterator:ListIterator<Box>, toIndex:number) {
		while (toIndex-- > 0) iterator.next();
	}

	/*private static updateIn(children:Iterator<Box>, index:number, newChildren:Iterator<Box> ) {
		return new Supplier<Box>() {
			int i = 0;
			public Box get() {
				if (i == index)
					children.next();
				if (i++ >= index && newChildren.hasNext()) {
					return newChildren.next();
				} else
					return children.next();
			}
		};
	}*/
}
