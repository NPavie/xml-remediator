import ConcurrentModificationException from './exceptions/ConcurrentModificationException';
import ListIterator from './ListIterator';
import QName from './QName';

import { Box, Rendering, BoxType } from './Box';
import Optional from './Optional';

import NoSuchElementException from './exceptions/NoSuchElementException';
import CanNotDoWalkerActionException from './exceptions/CanNotDoWalkerActionException';
import BoxFragment from './BoxFragment';


function deepCopyStack(stack:Array<ListIterator<Box>>) {
	return stack.map(iterable => iterable.clone());
}




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

    public path: Array<ListIterator<Box>>;
	
	private static noSuchElement = Optional.empty<Box>();
	static assertThat(test:boolean,message?:string) {
		if (!test) throw new CanNotDoWalkerActionException(message);
	}

	// For subtrees, reference to the origin tree for update propagations
	private _upper_tree?:BoxTreeWalker;

	/**
	 * 
	 * @param root root box of the walker
	 * @param upper_tree reference to the upper tree walker if there is one (to keep updates while walking on a subtree)
	 */
	constructor(root:Box, upper_tree?:BoxTreeWalker) {
		this._root = root;
		this.path = new Array<ListIterator<Box>>();
        this._current = root;
		this._upper_tree = upper_tree;
	}
	
	/**
	 * Create a clone of the current tree or subtree (with root and current hard-copied)
	 * Reference to the upper tree is preserved if there is one.
	 */
    clone():BoxTreeWalker {
        let clone = new BoxTreeWalker(this._root.copy(),this._upper_tree);
		clone.path = deepCopyStack(this.path);
		clone._current = this._current.copy();
        return clone;
	}
	
	/**
	 * Create a subtree (a new walker that start from the current node of the tree)
	 */
	subTree():BoxTreeWalker {
		return new BoxTreeWalker(this._current,this);
	}
	
	/**
	 * Get the current node of the walker
	 */
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
		if (this.path.length === 0) return BoxTreeWalker.noSuchElement;
		else {
			let siblings = this.path[this.path.length - 1];
			siblings.previous();
			if (!siblings.hasPrevious()) {
				siblings.next();
				return BoxTreeWalker.noSuchElement;
			} else {
				this._current = siblings.previous().value;
				siblings.next();
				return Optional.of(this._current);
			}
		}
	}
    
    nextSibling() : Optional<Box> {
		if (this.path.length == 0) return BoxTreeWalker.noSuchElement;
		else {
			let siblings = this.path[this.path.length - 1];
			if (!siblings.hasNext()) return BoxTreeWalker.noSuchElement;
			else {	
				this._current = siblings.next().value!;
				return Optional.of(this._current);
			}
		}
		
	}
	
	
	parent() : Optional<Box> {
		if (this.path.length == 0) return BoxTreeWalker.noSuchElement;
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
		if (!children.hasNext()) return BoxTreeWalker.noSuchElement;
		else {
			this._current = children.next().value!;
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
			return BoxTreeWalker.noSuchElement;	
		} else { // firstFollowing() signature
			for (let i = this.path.length - 1; i >= 0 ; i--) {
				let siblings = this.path[i];
				if (siblings.hasNext()) {
					this._current = siblings.next().value!;
					this.path.length = i + 1;
					return Optional.of(this._current);
				}
			}
			return BoxTreeWalker.noSuchElement;
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
						var p;
						if (!(p = this.previousSibling()).done) {
							previous = p;
							while (true)
								if (!(p = this.firstChild()).done) {
									previous = p;
									if (!(p = this.nextSibling()).done) {
										previous = p;
										while (!(p = this.nextSibling()).done)
											previous = p;
									}
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
			return BoxTreeWalker.noSuchElement;
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
								this._current = children.next().value!;
								this.path.push(children);
							}
						} else break;
					}
					return Optional.of(this._current);
				} else siblings.next();
			}
			return BoxTreeWalker.noSuchElement;
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
		} else return BoxTreeWalker.noSuchElement;
	}

	firstDescendant(filter:(node?:Box)=>boolean) : Optional<Box> {
		let startDepth = this.path.length;
		let keep_seeking = true;
		while (keep_seeking) {
			let next = this.firstChild();
			if (!next.isPresent()){
				if (this.path.length === startDepth) return BoxTreeWalker.noSuchElement;
				else {
					next = this.nextSibling();
					if (!next.isPresent()) {
						let keep_seeking_up = true;
						while (keep_seeking_up){ 
							next = this.parent();
							if (next.isPresent()) {
								if (this.path.length == startDepth) return BoxTreeWalker.noSuchElement;
								next = this.nextSibling();
								if (next.isPresent()) keep_seeking_up = false;;
							} else keep_seeking_up = false;;
						}
					}
				}
			}
			if (next.isPresent()) {
				if (filter(next.value)) return next;
			} else keep_seeking = false;
		}
		return BoxTreeWalker.noSuchElement;
    }
	
	/**
	 * Rename the current box with a new name and optionnaly a new attributes list
	 * @param name 
	 * @param attributes 
	 */
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

	/**
	 * returns current box (with different structure, but properties and visual presentation unchanged)
	 */
	unwrapFirstChild() {
		let children = this._current.children;
		if (!children.hasNext())
			throw new NoSuchElementException("there is no first child");
		let firstChild = children.next().value!;
		children.previous();
		console.log("unwrapFirstChild - " + firstChild.hasText());
		let newChildren = firstChild.hasText() ? 
			BoxTreeWalker.updateIn({
				list_to_update:children,
				from:0,
				new_elements:[firstChild.withName(null)]}) : 
			BoxTreeWalker.updateIn({
				list_to_update:children,
				from:0,
				new_elements:firstChild.children
			});
		console.log(newChildren);
		this.updateCurrent(this._current.withChildren(newChildren));
		return this._current;
	}

	unwrapNextSibling() {
		if (this.path.length == 0)
			throw new NoSuchElementException("there is no next sibling");
		let siblings = this.path[this.path.length - 1];
		if (!siblings.hasNext())
			throw new NoSuchElementException("there is no next sibling");
		let parent = this.parent().value!;
		let nextSibling = siblings.next().value!;
		let i = siblings.rewind();

		let newSiblings = nextSibling.hasText()
			? BoxTreeWalker.updateIn({
				list_to_update:siblings, from:i - 1, new_elements:[
					nextSibling.copy({
						name:undefined,
						attributes:new Map<QName,string>()
					})
				]
			}) : BoxTreeWalker.updateIn({
				list_to_update:siblings, from:i - 1, new_elements:nextSibling.children
			});
		
		this.updateCurrent(parent.withChildren(newSiblings));
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
		let new_siblings = BoxTreeWalker.updateIn({
			list_to_update:parentSiblings,
			from:j-1,
			new_elements:siblings
		});
		let newParent = this.parent().value!;
		this.updateCurrent(newParent.withChildren(new_siblings));
		this.firstChild();
		while (i-- > 1) this.nextSibling();
		while (j-- > 1) this.nextSibling();
		return this._current;
	}
    
    protected updateRoot(newRoot:Box) {
		this._root = newRoot;
		if(this._upper_tree !== undefined){
			this._upper_tree.updateCurrent(this._root);
		}
		
	}
    
    
    updateCurrent(newCurrent:Box) {
		if (this.path.length == 0)
			this.updateRoot(newCurrent);
		else {
			let newPath = [];
			let cur = newCurrent;
			while (this.path.length > 0) {
				let siblings = this.path[this.path.length - 1];
				let parent = this.parent().value!;
				let i = BoxTreeWalker.rewind(siblings);
				cur = parent.withChildren(
						BoxTreeWalker.updateIn({list_to_update:siblings,from:i-1,new_elements:[cur]})
				);
				siblings = cur.children;
				BoxTreeWalker.forward(siblings,i);
				newPath.unshift(siblings);
			}
			this.updateRoot(cur);
			this.path = newPath;
		}
		this._current = newCurrent;
	}

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
		//let parent = this.clone().parent().orElse(undefined);
		
		let newBox = this._current.props.type === BoxType.BLOCK ?
			Box.AnonymousBlockBox([this._current]) :
			Box.AnonymousInlineBox([this._current]);
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
		//let parent = this._current;
		let children;
		let childrenToWrap = new Array<Box>();
		if (childrenCount < 0) {
			if (this.firstChild().isPresent()) {
				children = this.path[this.path.length - 1];
				childrenToWrap.push(this._current);
				while (children.hasNext())
					childrenToWrap.push(children.next().value!);
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
					childrenToWrap.push(children.next().value!);
		}
		
		let newBox = childrenToWrap[0].props.type === BoxType.BLOCK ?
			Box.AnonymousBlockBox(childrenToWrap) :
			Box.AnonymousInlineBox(childrenToWrap);
		//instanceof Box.BlockBox
		//	? new Box.AnonymousBlockBox((Box.BlockBox)parent, _b -> childrenToWrap.iterator()::next)
		//	: new Box.InlineBox(null, parent, _b -> childrenToWrap.iterator()::next);
		if (wrapper != null || attributes != null)
			newBox = newBox.copy({name:wrapper, attributes:attributes});
		BoxTreeWalker.rewind(children);
		this.parent();
		
		this.updateCurrent(
				this._current.copy({
					children: BoxTreeWalker.updateIn({
						list_to_update:children, 
						from:0, 
						end:childrenToWrap.length, 
						new_elements:[newBox]
					})
				}));
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

	public wrapNextSiblings(siblingCount:number, wrapper:QName, attributes?:Map<QName,string> ) {
		if (this.path.length === 0)
			throw new NoSuchElementException("there are no next siblings");
		let siblings = this.path[this.parent.length - 1];
		let parent = this.parent().value;
		let siblingsToWrap = new Array<Box>();
		for (let i = 0; i < siblingCount; i++) {
			if (!siblings.hasNext())
				throw new NoSuchElementException("there are no " + siblingCount + " next siblings");
			else
				siblingsToWrap.push(siblings.next().value!);
		}
		let first = BoxTreeWalker.rewind(siblings) - siblingCount;
		let newBox = siblingsToWrap[0].props.type === BoxType.BLOCK ?
			Box.AnonymousBlockBox(siblingsToWrap) :
			Box.AnonymousInlineBox(siblingsToWrap);
			
		if (wrapper || attributes)
			newBox = newBox.copy({name:wrapper, attributes:attributes});
		this.updateCurrent(
				this._current.copy({
					children:BoxTreeWalker.updateIn({
						list_to_update:siblings, 
						from:first, 
						end:first + siblingCount, 
						new_elements:[newBox]
					})
				}));
		this.firstChild();
		while (first-- > 1) this.nextSibling();
		return this._current;
	}

	private static forward(iterator:ListIterator<Box>, toIndex:number) {
		while (toIndex-- > 0) iterator.next();
	}

	/**
	 * Update 
	 * @param args.children original iterator to update 
	 * @param args.from index of the first element to update (== replaced by one or more new node)
	 * @param args.end original iterator to update 
	 * @param args.new_children List of node to insert in place of the node to be updated
	 * @return an array of the updated list of node
	 */
	private static updateIn(args:{
		list_to_update:ListIterator<Box>,
		from:number,
		end?:number,
		new_elements:Array<Box>|ListIterator<Box>
	}):Array<Box>{
		let updated_list = new Array<Box>();
		let i = 0;
		let iterator = args.list_to_update;
		while(iterator.hasNext()){
			let element = iterator.next().value;
			if(i++ === args.from){ // start children replacement
				if(args.end != null){ // end is defined == multiple children are to be replaced
					// replace the current node
					for(let new_element of args.new_elements){
						updated_list.push(new_element);
					}
					// passes the from to end elements (logic copied from java)
					//if(args.from < args.end) iterator.next();
					while(i++ < args.end) iterator.next();
				} else {
					// replace current child with the input children
					for(let new_child of args.new_elements){
						updated_list.push(new_child);
					}
				}
			} else { // keep the current child
				updated_list.push(element!);
			}
		}
		
		return updated_list;
	}

}
