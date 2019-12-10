import ConcurrentModificationException from './exceptions/ConcurrentModificationException';
import ListIterator from './ListIterator';
import QName from './QName';
import CanNotPerformTransformationException from './exceptions/CanNotPerformTransformationException';

import Box from './Box'



function deepCopyStack(stack:Array<ListIterator<Box>>) {
	return stack.map(iterable => iterable.clone());
}

function assertThat(test:boolean) {
	if (!test) throw new CanNotPerformTransformationException();
}


/** Box selection filters */
function isBlockAndHasNoBlockChildren(b?:Box){
	return b ? b.isBlockAndHasNoBlockChildren : true;
}

function isReplacedElementOrTextBox(b?: Box) {
    return b ? b.props.text != null || b.props.isReplacedElement : true;
}

class Optional<T>{
    public done:boolean;
    public value?:T;
    constructor(done:boolean, value?:T){
        this.done = done;
        this.value = value;
    }
    public static of<T>(value:undefined | T){
        return new Optional<T>(value == null ? false : true, value);
    }
        
}

var noSuchElement = Optional.of<Box>(undefined);


export default class BoxTreeWalker {
    rootBox: Box;
    path: Array<ListIterator<Box>>;
    current: Box;

    
	constructor(root:Box, updateRootCallback?:((newroot:Box)=>void)) {
		this.rootBox = root;
		this.path = [];
        this.current = root;
        if(updateRootCallback) this.updateRoot = updateRootCallback;
	}
    
    clone():BoxTreeWalker {
        let clone = new BoxTreeWalker(this.rootBox);
		clone.path = deepCopyStack(this.path);
        clone.current = this.current;
        return clone;
    }
    
	subTree():BoxTreeWalker {
		if (this.path.length == 0)
            return this;
		let fullTree = this;
		let subTree = new BoxTreeWalker(fullTree.current, (root:Box) => {
            if (this.rootBox != fullTree.current)
				throw new ConcurrentModificationException();
			else {
				this.rootBox = root;
				fullTree.updateCurrent(root);
			}
        });
		return subTree;
    }
    
	parent() {
		if (this.path.length == 0)
			return noSuchElement;
		this.path.pop();
		if (this.path.length == 0)
			this.current = this.rootBox;
		else {
			let peek = this.path[this.path.length - 1];
			this.current = peek.previous().value!;
			peek.next();
		}
		return Optional.of(this.current);
	}
	root() {
		while (!this.parent().done);
		return this.current;
	}
	previousSibling() {
		if (this.path.length == 0)
			return noSuchElement;
		let siblings = this.path[this.path.length - 1];
		siblings.previous();
		if (!siblings.hasPrevious()) {
			siblings.next();
			return noSuchElement;
		}
		this.current = siblings.previous().value!;
		siblings.next();
		return Optional.of(this.current);
	}
    
    nextSibling() {
		if (this.path.length == 0)
			return noSuchElement;
		let siblings = this.path[this.path.length - 1];
		if (!siblings.hasNext())
			return noSuchElement;
		this.current = siblings.next().value;
		return Optional.of(this.current);
	}
    
    firstChild() {
		let children = this.current.children;
		if (!children.hasNext())
			return noSuchElement;
		this.current = children.next().value;
		this.path.push(children);
		return Optional.of(this.current);
    }
    
	firstFollowing(filter?:(node?:Box)=>boolean) : Optional<Box>{
		if (!filter) {
			for (let i = this.path.length - 1; i >= 0 ; i--) {
				let siblings = this.path[i];
				if (siblings.hasNext()) {
					this.current = siblings.next().value;
					this.path.length = i + 1;
					return Optional.of(this.current);
				}
			}
			return noSuchElement;
		} else {
			let savePath = deepCopyStack(this.path);
			let saveCurrent = this.current;
			while (true) {
				let next;
				if (!(next = this.firstFollowing()).done) {
					if (filter(next.value) || !(next = this.firstDescendant(filter)).done)
						return next;
				} else
					break;
			}
			this.path = savePath;
			this.current = saveCurrent;
			return noSuchElement;
		}
	}

	firstPreceding(filter?:(node?:Box)=>boolean) : Optional<Box> {
		if (!filter) {
			for (let i = this.path.length - 1; i >= 0 ; i--) {
				let siblings = this.path[i];
				siblings.previous();
				if (siblings.hasPrevious()) {
					this.current = siblings.previous().value!;
					siblings.next();
					this.path.length = i + 1;
					while (true) {
						let children = this.current.children;
						if (children.hasNext()) {
							while (children.hasNext()) {
								this.current = children.next().value;
								this.path.push(children);
							}
						} else
							break;
					}
					return Optional.of(this.current);
				} else
					siblings.next();
			}
			return noSuchElement;
		} else {
			let savePath = deepCopyStack(this.path);
			let saveCurrent = this.current;
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
			this.current = saveCurrent;
			return noSuchElement;
		}
	}

	firstParent(filter?:(node?:Box)=>boolean) : Optional<Box> {
		for (let i = this.path.length - 2; i >= 0 ; i--) {
			let parent = this.path[i].previous().value;
			this.path[i].next();
			if (filter && filter(parent)) {
				this.path.length = i + 1;
				this.current = parent!;
				return Optional.of(this.current);
			}
		}
		if (filter && filter(this.rootBox)) {
			this.path.length = 0;
			this.current = this.rootBox;
			return Optional.of(this.current);
		}
		return noSuchElement;
	}

	firstDescendant(filter?:(node?:Box)=>boolean) : Optional<Box> {
		let startDepth = this.path.length;
		while (true) {
			let next;
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
    
	renameCurrent(name:QName) {
		let renamed = this.current.withName(name);
		this.updateCurrent(renamed);
		return this.current;
    }
    
	deleteFirstChild() {
		let children = this.current.children;
		if (!children.hasNext())
			throw new RuntimeException("there is no first child");
		children.next();
		this.updateCurrent(this.current.withChildren(children));
		return this.current;
	}

	unwrapFirstChild() {
		let children = this.current.children;
		if (!children.hasNext())
			throw new RuntimeException("there is no first child");
		let firstChild = children.next().value;
		children.previous();
		let children_array = children.consume();
		if (firstChild.text != null)
			children_array[0] = firstChild.withName(null);
		else
			children_array = firstChild.children.consume().concat(children_array.slice(1));
		this.updateCurrent(this.current.withChildren(children_array));
		return this.current;
	}

	unwrapNextSibling() {
		if (this.path.length == 0)
			throw new RuntimeException("there is no next sibling");
		let siblings = this.path[this.path.length - 1];
		if (!siblings.hasNext())
			throw new RuntimeException("there is no next sibling");
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
		return this.current;
	}
	unwrapParent() {
		if (this.path.length == 0)
			throw new RuntimeException("there is no parent");
		if (this.path.length == 1)
			throw new RuntimeException("root can not be unwrapped");
		let siblings = this.path[this.path.length - 1];
		this.parent();
		let parentSiblings = this.path[this.path.length - 1];
		let i = rewind(siblings);
		let j = rewind(parentSiblings);
		let parentSiblings_array = parentSiblings.consume();
		parentSiblings_array = parentSiblings_array.slice(0, j - 1).concat(consume(siblings)).concat(parentSiblings_array.slice(j));
		let newParent = this.parent().value;
		if(newParent)
			this.updateCurrent(newParent.withChildren(parentSiblings_array));
		this.firstChild();
		while (i-- > 1) this.nextSibling();
		while (j-- > 1) this.nextSibling();
		return this.current;
	}
    
    protected updateRoot(newRoot:Box) {
		this.rootBox = newRoot;
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
				let i = rewind(siblings);
				let siblings_array = consume(siblings);
				siblings_array[i - 1] = cur;
				cur = parent!.withChildren(siblings_array);
				siblings = cur.children;
				siblings.forward( i);
				newPath.unshift(siblings);
			}
			this.updateRoot(cur);
			this.path = newPath;
		}
		this.current = newCurrent;
	}


	nthBlock(index:number) {
		assertThat(!this.firstDescendant(isBlockAndHasNoBlockChildren).done);
		for (let i = 0; i < index; i++)
			assertThat(!this.firstFollowing(isBlockAndHasNoBlockChildren).done);
	}

	nthReplacedElementOrTextBox(index: number) {
		assertThat(!this.firstDescendant(isReplacedElementOrTextBox).done);
		for (let i = 0; i < index; i++)
			assertThat(!this.firstFollowing(isReplacedElementOrTextBox).done);
	}

	count(filter:(b?:Box)=>boolean) {
		let count = 0;
		while (!this.firstDescendant(filter).done || !this.firstFollowing(filter).done)
			count++;
		return count;
	}

	transformSingleRowTable(firstBlockIdx:number, blockCount:number) : BoxTreeWalker {
		this.root();
		this.nthBlock(firstBlockIdx);
		while (true) {
			assertThat(this.previousSibling().done);
			if (this.current.props.cssprops && this.current.props.cssprops.display == "table-cell")
				break;
			else {
				assertThat(!(this.current.props.cssprops && this.current.props.cssprops.display === "block"));
				assertThat(!this.parent().done);
			}
		}
		this.renameCurrent(DIV);
		assertThat(this.previousSibling().done);
		while (true) {
			if (!this.nextSibling().done) {
				assertThat(this.current.props.cssprops && this.current.props.cssprops.display == "table-cell");
				this.renameCurrent(DIV);
			} else
				break;
		}
		assertThat(!this.parent().done);
		//assertThat(this.current.props.cssprops && this.current.props.cssprops.display == "table-row");
		this.renameCurrent(DIV);
		assertThat(this.nextSibling().done);
		assertThat(this.previousSibling().done);
		assertThat(!this.parent().done);
		if (true) { // this.current.props.cssprops && this.current.props.cssprops.display == "table-row-group"
			assertThat(this.nextSibling().done);
			assertThat(this.previousSibling().done);
			assertThat(!this.parent().done);
		}
		//assertThat(this.current.props.cssprops && this.current.props.cssprops.display == "table");
		this.firstChild();
		this.unwrapParent();
		let table = this.subTree();
		assertThat(count(table, isBlockAndHasNoBlockChildren) == blockCount);
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
				&& count(tmp, isBlockAndHasNoBlockChildren) <= blockCount) {
				doc = tmp;
			} else {
				assertThat(count(doc, isBlockAndHasNoBlockChildren) == blockCount);
				break;
			}
		}
		doc.renameCurrent(this.H1);
		// remove all strong within the heading
		let h1Walker: BoxTreeWalker = doc.subTree();
		let isStrong: (node?: Box) => boolean = b => b ? this.STRONG == b.props.name : true;
		while (!h1Walker.firstDescendant(isStrong).done || !h1Walker.firstFollowing(isStrong).done)
			if (!h1Walker.previousSibling().done)
				h1Walker.unwrapNextSibling();
			else if (!h1Walker.parent().done)
				h1Walker.unwrapFirstChild();
			else
				throw new RuntimeException("coding error");
		// remove all div within the heading
		h1Walker.root();
		let isDiv: (node?: Box) => boolean = b => b ? DIV == b.props.name : true;
		while (!h1Walker.firstDescendant(isDiv).done || !h1Walker.firstFollowing(isDiv).done)
			h1Walker.renameCurrent(this._SPAN);
		return doc;
	}

	removeImage(blockIdx: number, inlineIdx: number) : BoxTreeWalker {
		this.root();
		this.nthBlock(blockIdx);
		if (inlineIdx >= 0) {
			assertThat(inlineIdx < count(this, isReplacedElementOrTextBox));
			this.nthReplacedElementOrTextBox(inlineIdx);
		}
		assertThat(this.IMG == this.current.props.name);
		assertThat(this.current.props.isReplacedElement);
		this.renameCurrent(this._SPAN);
		return this;
	}


	IMG: QName = new QName({
		namespace: "http://www.w3.org/1999/xhtml",
		localPart: "img",
		prefix: ""
	});

	H1: QName = new QName({
		namespace: "http://www.w3.org/1999/xhtml",
		localPart: "h1",
		prefix: ""
	});

	STRONG: QName = new QName({
		namespace: "http://www.w3.org/1999/xhtml",
		localPart: "strong",
		prefix: ""
	});

	_SPAN: QName = new QName({
		namespace: "http://www.w3.org/1999/xhtml",
		localPart: "_span",
		prefix: ""
	});
}
