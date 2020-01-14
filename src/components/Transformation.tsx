
import { Box } from "./Box";
import BoxTreeWalker, { BoxFilter } from "./BoxTreeWalker";
import QName from './QName';
import CanNotPerformTransformationException from "./exceptions/CanNotPerformTransformationException";


export class InputRange {
    // 0-based index of start block
    public startBlockIndex:number;
    // if non-negative, 0-based index of the start inline unit within the start block
    public startInlineIndex:number;
    // number of blocks or inline units in the range
    public size:number;
    
    constructor(startBlockIndex:number, startInlineIndex:number = -1, size:number = 1) {
        if (startBlockIndex < 0) throw new Error('startBlockIndex cannot be negative');
        if (size < 1) throw new Error("InputRange size cannot be less than 1");
        this.startBlockIndex = startBlockIndex;
        this.startInlineIndex = startInlineIndex;
        this.size = size;
    }
};

/**
 * Transformation to apply on the input range of a given doc
 */
export default class Transformation{

    public static readonly HTML_NS = "http://www.w3.org/1999/xhtml";
	public static readonly EPUB_NS = "http://www.idpf.org/2007/ops";
	public static readonly DIV = new QName({namespace:Transformation.HTML_NS, localPart:"div"});
	public static readonly P = new QName({namespace:Transformation.HTML_NS, localPart:"p"});
	public static readonly SPAN = new QName({namespace:Transformation.HTML_NS, localPart:"span"});
	public static readonly STRONG = new QName({namespace:Transformation.HTML_NS, localPart:"strong"});
	public static readonly EM = new QName({namespace:Transformation.HTML_NS, localPart:"em"});
	public static readonly SMALL = new QName({namespace:Transformation.HTML_NS, localPart:"small"});
	public static readonly IMG = new QName({namespace:Transformation.HTML_NS, localPart:"img"});
	public static readonly LI = new QName({namespace:Transformation.HTML_NS, localPart:"li"});
	public static readonly UL = new QName({namespace:Transformation.HTML_NS, localPart:"ul"});
	public static readonly OL = new QName({namespace:Transformation.HTML_NS, localPart:"ol"});
	public static readonly A = new QName({namespace:Transformation.HTML_NS, localPart:"a"});
	public static readonly HREF = new QName({namespace:"", localPart:"href"});
	public static readonly FIGURE = new QName({namespace:Transformation.HTML_NS, localPart:"figure"});
	public static readonly FIGCAPTION = new QName({namespace:Transformation.HTML_NS, localPart:"figcaption"});
	public static readonly H1 = new QName({namespace:Transformation.HTML_NS, localPart:"h1"});
	public static readonly H2 = new QName({namespace:Transformation.HTML_NS, localPart:"h2"});
	public static readonly H3 = new QName({namespace:Transformation.HTML_NS, localPart:"h3"});
	public static readonly H4 = new QName({namespace:Transformation.HTML_NS, localPart:"h4"});
	public static readonly H5 = new QName({namespace:Transformation.HTML_NS, localPart:"h5"});
	public static readonly H6 = new QName({namespace:Transformation.HTML_NS, localPart:"h6"});

	private static readonly EPUB_TYPE_Z3998_POEM:Map<QName,string> = new Map<QName,string>([
            [new QName({namespace: Transformation.EPUB_NS, localPart : "type"}), "z3998:poem"]
        ]);
    private static readonly EPUB_TYPE_PAGEBREAK:Map<QName,string> = new Map<QName,string>([
			[new QName({namespace: Transformation.EPUB_NS, localPart : "type"}), "pagebreak"]
		]);
    

    private doc:BoxTreeWalker;
    private root:BoxTreeWalker;
    private currentRange:InputRange;

    constructor(doc:Box){
        this.root = new BoxTreeWalker(doc);
        this.doc = this.root.subTree();
        this.currentRange = new InputRange(0);
    }

	static assertThat(test:boolean,message?:string) {
		if (!test) throw new CanNotPerformTransformationException(message);
	}

    get(){
        return this.root.current();
    }

    moveTo(startBlockIndex:number, startInlineIndex?:number, size?:number) {
		this.currentRange = new InputRange(startBlockIndex,startInlineIndex,size);
		return this;
    }
	
	transformTable(singleRow:boolean){
		
		this.doc = this.moveToRange(this.doc, this.currentRange);
		this.doc = Transformation.transformTable(this.doc, this.currentRange!.size, singleRow);
		return this;
	}

    moveToRange(
			doc:BoxTreeWalker, 
			range:InputRange) {
        Transformation.assertThat(range != null);
		doc.root();
		let n = range.startBlockIndex;
		if (doc.current().isBlockAndHasNoBlockChildren())
			Transformation.assertThat(n === 0);
		else {
			doc = Transformation.moveNBlocks(doc, n + 1);
			if (range.startInlineIndex >= 0) {
                let isReplacedElementOrTextBox = (b?:Box) => {
                   	return b ? (b.hasText() || b.isReplacedElement()) : false;
				};
				let c = Transformation.count(doc, isReplacedElementOrTextBox);
				Transformation.assertThat(range.startInlineIndex < c, `${range.startInlineIndex} < ${c}`);
				Transformation.assertThat(doc.firstDescendant(BoxFilter.isReplacedElementOrTextBox).isPresent());
				for (let i = 0; i < range.startInlineIndex; ++i){
					Transformation.assertThat(doc.firstFollowing(BoxFilter.isReplacedElementOrTextBox).isPresent());
				}
					
			}
		}
		return doc;
	}
	
    
    /**
	 * move
	 * @param doc 
	 * @param n 
	 */
    private static moveNBlocks(
			doc:BoxTreeWalker, 
			n:number) {
		if (n > 0) {
			if(doc.firstDescendant(BoxFilter.isBlockAndHasNoBlockChildren).isPresent()){
				n--;
			}
			while (n-- > 0){
				let testing = doc.firstFollowing(BoxFilter.isBlockAndHasNoBlockChildren);
				Transformation.assertThat(testing.isPresent());
			}
		} else if (n < 0) {
			if (doc.firstParent(BoxFilter.isBlockAndHasNoBlockChildren).isPresent()) n++;
			while (n++ < 0) Transformation.assertThat(doc.firstPreceding(BoxFilter.isBlockAndHasNoBlockChildren).isPresent());
		}
		return doc;
    }
	


    /*
	 * @param blockCount number of blocks in table (one or more)
	 */
	private static transformTable(
			doc:BoxTreeWalker, 
			blockCount:number, 
			singleRow:boolean) {
		Transformation.assertThat(doc.current().isBlockAndHasNoBlockChildren());
		// find and rename first cell
		while (true) {
            Transformation.assertThat(!doc.previousSibling().isPresent());
            let props = doc.current().props.cssprops;
			if (props && props.display === "table-cell")
				break;
			else {
				Transformation.assertThat(!(props ? props.display === "block" : false));
			Transformation.assertThat(doc.parent().isPresent());
			}
		}
		doc.renameCurrent(Transformation.DIV);
		// check that this is the first cell in the row
		Transformation.assertThat(!doc.previousSibling().isPresent());
		//  rename other cells in this row
		while (doc.nextSibling().isPresent()) {
            let props = doc.current().props.cssprops;
			Transformation.assertThat(props ? props.display === "table-cell" : false);
			doc.renameCurrent(Transformation.DIV);
		}
		// rename row
        Transformation.assertThat(doc.parent().isPresent());
        let props = doc.current().props.cssprops;
		Transformation.assertThat(props ? props.display === "table-row" : false);
		doc.renameCurrent(Transformation.DIV);
		// check that this is the first row in the table (or tbody)
		Transformation.assertThat(!doc.previousSibling().isPresent());
		if (singleRow)
			Transformation.assertThat(!doc.nextSibling().isPresent());
		else
			// process other rows
			while (doc.nextSibling().isPresent()) {
                props = doc.current().props.cssprops;
				Transformation.assertThat(props ? props.display === "table-row" : false);
				doc.renameCurrent(Transformation.DIV);
				Transformation.assertThat(doc.firstChild().isPresent());
				doc.renameCurrent(Transformation.DIV);
				while (doc.nextSibling().isPresent()) {
                    props = doc.current().props.cssprops;
					Transformation.assertThat(props ? props.display === "table-cell" : false);
					doc.renameCurrent(Transformation.DIV);
				}
				doc.parent();
			}
		Transformation.assertThat(doc.parent().isPresent());
        // find table
        props = doc.current().props.cssprops;
		if (props ? props.display === "table-row-group" : false) {
			// check that there is only one tbody and no thead or tfoot
			Transformation.assertThat(!doc.nextSibling().isPresent());
			Transformation.assertThat(!doc.previousSibling().isPresent());
			Transformation.assertThat(doc.parent().isPresent());
        }
        props = doc.current().props.cssprops;
		Transformation.assertThat(props ? props.display === "table" : false);
		// check number of cells in table
		Transformation.assertThat(Transformation.count(doc, BoxFilter.isBlockAndHasNoBlockChildren) === blockCount);
		// unwrap table
		doc.firstChild();
		doc.unwrapParent();
		return doc;
	}


	markupHeading(headingElement:QName){
		this.doc = this.moveToRange(this.doc, this.currentRange!);
		this.doc = Transformation.markupHeading(
			this.doc, 
			this.currentRange!.size, -1, 
			headingElement);
		return this;
	}

    private static markupHeading(
			doc:BoxTreeWalker,
            blockCount:number,
            indexOfHeading:number,
            headingElement:QName,
            headerElement?:QName) {
		Transformation.assertThat(doc.current().isBlockAndHasNoBlockChildren());
		if (indexOfHeading >= 0) {
			doc = Transformation.moveNBlocks(doc, indexOfHeading);
			// move to parent block if no siblings
			doc = Transformation.wrapIfNeeded(doc, 1);
		} else {
			// find ancestor that contains the specified number of blocks, or create it
			doc = Transformation.wrapIfNeeded(doc, blockCount);
		}
		// rename to heading
		doc.renameCurrent(headingElement);
		// remove strong, em and small within the heading
		doc = Transformation.removeEmInAllEmBox(doc, Transformation.STRONG);
		doc = Transformation.removeEmInAllEmBox(doc, Transformation.EM);
		doc = Transformation.removeEmInAllEmBox(doc, Transformation.SMALL);
		// remove all div and p within the heading
		// remove all span within the heading
		let h = doc.subTree();
        let isDivOrPOrSpan = (b?:Box) => {
                if( b && b.getName() )
                    return Transformation.DIV.equals(b.getName()!) 
                        || Transformation.P.equals(b.getName()!) 
                        || Transformation.SPAN.equals(b.getName()!);
                else return false;}
		while (h.firstDescendant(isDivOrPOrSpan).isPresent() || h.firstFollowing(isDivOrPOrSpan).isPresent()) {
			if (!Transformation.SPAN.equals(h.current().getName()!))
				h.renameCurrent(Transformation.SPAN);
			h.markCurrentForUnwrap();
		}
		if (indexOfHeading >= 0 && headerElement != null) {
			doc = Transformation.moveNBlocks(doc, - indexOfHeading);
			// find ancestor that contains the specified number of blocks, or create it
			Transformation.assertThat(blockCount > 1);
			doc = Transformation.wrapIfNeeded(doc, blockCount);
			// rename to header
			doc.renameCurrent(headerElement);
			// make sure there is only one heading inside the header
			let header = doc.subTree();
			header.firstDescendant(BoxFilter.isBlockAndHasNoBlockChildren);
			do {
				if (indexOfHeading-- !== 0) {
					let name = header.current().getName();
                    if (name && (Transformation.H1.equals(name) 
                            || Transformation.H2.equals(name) 
                            || Transformation.H3.equals(name) 
                            || Transformation.H4.equals(name) 
                            || Transformation.H5.equals(name) 
                            || Transformation.H6.equals(name)))
						header.renameCurrent(Transformation.P);
				}
			} while (header.firstFollowing(BoxFilter.isBlockAndHasNoBlockChildren).isPresent());
		}
		return doc;
	}

	removeImage() {
		this.doc = this.moveToRange(this.doc, this.currentRange);
		this.doc = Transformation.removeImage(this.doc, this.currentRange.size);
		return this;
	}

	private static removeImage(
			doc:BoxTreeWalker, 
			size:number) {
        Transformation.assertThat(size === 1);
        let name = doc.current().getName();
		Transformation.assertThat(name ? Transformation.IMG.equals(name) : false);
		Transformation.assertThat(doc.current().isReplacedElement());
		doc.markCurrentForRemoval();
		// also remove parent elements that have no other content than the img
		while (!doc.previousSibling().isPresent()
		       && !doc.nextSibling().isPresent()
		       && doc.parent().isPresent())
			doc.markCurrentForRemoval();
		return doc;
	}

	private static convertToList(
			doc:BoxTreeWalker,
            blockCount:number,
            listElement:QName,
            listAttributes:Map<QName,string>,
            listItemElement:QName){
		Transformation.assertThat(doc.current().isBlockAndHasNoBlockChildren());
		// find ancestor that contains the specified number of blocks, or create it
		doc = Transformation.wrapIfNeeded(doc, blockCount);
		// rename to list or wrap with new list element
		if (doc.current().isBlockAndHasNoBlockChildren())
			doc.wrapCurrent(listElement, listAttributes);
		else {
			doc.renameCurrent(listElement, listAttributes);
			doc.firstChild();
		}
		// rename list items
		do {
			doc.renameCurrent(listItemElement);
		} while (doc.nextSibling().isPresent());
		return doc;
	}

	private static convertToPoem(
			doc:BoxTreeWalker, 
			blockCount:number) {
        return Transformation.convertToList(doc, 
                blockCount, 
                Transformation.DIV, 
                Transformation.EPUB_TYPE_Z3998_POEM, 
                Transformation.P);
	}

	private static transformNavList(
			doc:BoxTreeWalker, 
			blockCount:number) {
		Transformation.assertThat(doc.current().isBlockAndHasNoBlockChildren());
		// find root list element
		let listBlockCount = 1;
		while (true) {
			let tmp = doc.clone();
			if (!tmp.previousSibling().isPresent()
                    && tmp.parent().isPresent()
                    && (listBlockCount = Transformation.count(tmp, BoxFilter.isBlockAndHasNoBlockChildren)) <= blockCount) {
                doc = tmp;
                let name = doc.current().getName();
				if (listBlockCount === blockCount && (name ? Transformation.OL.equals(name) : false))
					break;
			} else
				Transformation.assertThat(false);
        }
        // process items
        let apply = ((ol:BoxTreeWalker) => {
            Transformation.assertThat(ol.firstChild().isPresent());
            do {
                let name  = ol.current().getName();
                Transformation.assertThat(name ? Transformation.LI.equals(name) : false);
                Transformation.assertThat(ol.firstChild().isPresent());
                let childCount = 1;
                while (ol.nextSibling().isPresent()) childCount++;
                name  = ol.current().getName();
                if (childCount === 1 &&  (name ? Transformation.A.equals(name) : false) && ol.current().getAttributes().has(Transformation.HREF)) {
                    ol.parent();
                    continue;
                }
                name  = ol.current().getName();
                if (name ? Transformation.OL.equals(name) : false) {
                    if (childCount === 1)
                        Transformation.assertThat(false);
                    // process nested list
                    ol = apply(ol);
                    if (childCount === 2) {
                        ol.previousSibling();
                        name  = ol.current().getName();
                        if ((name ? Transformation.A.equals(name) : false) && ol.current().getAttributes().has(Transformation.HREF)) {
                            ol.parent();
                            continue;
                        }
                    } else {
                        ol.parent();
                        ol.wrapFirstChildren(childCount - 1, Transformation.SPAN);
                        childCount = 2;
                        ol.firstChild();
                    }
                } else if (childCount > 1) {
                    ol.parent();
                    ol.wrapChildren(Transformation.SPAN);
                    childCount = 1;
                    ol.firstChild();
                }
                // find first descendant a
                let span = ol.subTree();
                let isAWithHref = (b?:Box) => {
                        let name = b ? b.getName() : undefined;
                        return (name ? Transformation.A.equals(name) : false) && (b ? b.getAttributes().has(Transformation.HREF) : false) ;
                    };
                if (!span.firstDescendant(isAWithHref).isPresent())
                    if (childCount === 2) {
                        ol.parent();
                        continue;
                    } else
                        Transformation.assertThat(false);
                let a = span.current();
                let href = a.getAttributes().get(Transformation.HREF);
                // remove this a and all other a with the same href
                span.root();
                let isAwithFoundHref = (b?:Box)=>{
                    let name = b ? b.getName() : undefined;
                    return (name ? Transformation.A.equals(name) : false) && (b ? href === b.getAttributes().get(Transformation.HREF) : false) ;
                };
                span = Transformation.unwrapAll(span,isAwithFoundHref);
                // rename span to a
                span.renameCurrent(a.getName()!, a.getAttributes());
                ol.parent();
            } while (ol.nextSibling().isPresent());
            ol.parent();
            return ol;
        });
		apply(doc);
		// remove all div and p within the table of contents
		let toc = doc.subTree();
		let isDivOrP = (b?:Box) => {
			let name = b ? b.getName() : undefined;
			return name ? Transformation.DIV.equals(name) || Transformation.P.equals(name) : false;
		};
		while (toc.firstDescendant(isDivOrP).isPresent() || toc.firstFollowing(isDivOrP).isPresent()) {
			toc.renameCurrent(Transformation.SPAN);
			toc.markCurrentForUnwrap();
		}
		return doc;
	}

	private static wrapList(
			doc:BoxTreeWalker,
			blockCount:number,
			preContentBlockCount:number,
			wrapper:QName) {
		Transformation.assertThat(doc.current().isBlockAndHasNoBlockChildren());
		doc = Transformation.moveNBlocks(doc, preContentBlockCount);
		// find list element
		let listBlockCount = 1;
		while (true) {
			let tmp = doc.clone();
			if (!tmp.previousSibling().isPresent()
			    	&& tmp.parent().isPresent()) {
				listBlockCount = Transformation.count(tmp, BoxFilter.isBlockAndHasNoBlockChildren);
				if(listBlockCount <= (blockCount - preContentBlockCount)){
					doc = tmp;
					let name = doc.current().getName();
					if (listBlockCount === (blockCount - preContentBlockCount)
							&& (name ? Transformation.OL.equals(name) || Transformation.UL.equals(name) : false))
						break;
				} 
			} else
				Transformation.assertThat(false);
		}
		let listHasNextSibling = doc.nextSibling().isPresent();
		if (listHasNextSibling)
			doc.previousSibling();
		// find elements belonging to pre-content
		let childrenCount = 1;
		if (preContentBlockCount > 0) {
			while (doc.previousSibling().isPresent()) {
				childrenCount++;
				preContentBlockCount -= Transformation.count(doc, BoxFilter.isBlockAndHasNoBlockChildren);
				if (preContentBlockCount <= 0) break;
			}
			Transformation.assertThat(preContentBlockCount === 0);
		}
		let preContentHasPreviousSibling = doc.previousSibling().isPresent();
		if (preContentHasPreviousSibling) {
			doc.wrapNextSiblings(childrenCount, wrapper);
			doc.nextSibling();
		} else if (listHasNextSibling) {
			doc.parent();
			doc.wrapFirstChildren(childrenCount, wrapper);
			doc.firstChild();
		} else {
			Transformation.assertThat(doc.parent().isPresent());
			let name = doc.current().getName();
			if (!(name ? wrapper.equals(name) : false))
				if (name ? Transformation.DIV.equals(name) : false)
					doc.renameCurrent(wrapper);
				else {
					doc.wrapChildren(wrapper);
					doc.firstChild();
				}
		}
		return doc;
	}

	private static wrapListInPrevious(
			doc:BoxTreeWalker,
			blockCount:number) {
		doc = Transformation.wrapList(doc, blockCount, 1, new QName({localPart:"_"}));
		let wrapper = doc.firstChild().value!.getName()!;
		doc.renameCurrent(new QName({localPart:""}));
		doc.parent();
		doc.renameCurrent(wrapper);
		return doc;
	}

	private static wrapInFigure(doc:BoxTreeWalker,
			blockCount:number,
			captionBlockCount:number,
			captionBefore:boolean) {
		Transformation.assertThat(doc.current().isBlockAndHasNoBlockChildren());
		Transformation.assertThat(blockCount > captionBlockCount);
		if (captionBlockCount > 0) {
			if (!captionBefore)
				doc = Transformation.moveNBlocks(doc, blockCount - captionBlockCount);
			doc = Transformation.wrapIfNeeded(doc, captionBlockCount);
			doc.renameCurrent(Transformation.FIGCAPTION);
			doc = Transformation.removeEmInAllEmBox(doc, Transformation.STRONG);
			doc = Transformation.removeEmInAllEmBox(doc, Transformation.EM);
			doc = Transformation.removeEmInAllEmBox(doc, Transformation.SMALL);
			if (!captionBefore)
				doc = Transformation.moveNBlocks(doc, captionBlockCount - blockCount);
			else if (!doc.current().isBlockAndHasNoBlockChildren())
				doc.firstDescendant(BoxFilter.isBlockAndHasNoBlockChildren);
		}
		doc = Transformation.wrapIfNeeded(doc, blockCount);
		doc.renameCurrent(Transformation.FIGURE);
		if (blockCount - captionBlockCount === 1 && captionBlockCount != 0) {
			doc.firstChild();
			doc.nextSibling();
			let name = doc.current().getName();
			if ( name ? Transformation.DIV.equals(name) || Transformation.P.equals(name): false)
				doc.markCurrentForUnwrap();
		}
		return doc;
	}

	private static removeHiddenBox(
			doc:BoxTreeWalker,
			size:number){
		Transformation.assertThat(doc.current().isBlockAndHasNoBlockChildren());
		Transformation.assertThat(size === 1);
		let cssprops = doc.current().props.cssprops;
		Transformation.assertThat( cssprops ? "hidden" === cssprops.visibility : false);
		// check that all contained boxes inherit visibility
		let box = doc.subTree();
		
		while (box.firstChild().isPresent() || box.firstFollowing().isPresent()){
			cssprops = box.current().props.cssprops;
			Transformation.assertThat(cssprops ? "hidden" === cssprops.visibility : false);
		}
			
		// remove
		doc.markCurrentForRemoval();
		// also remove parent elements that have no other content than the current box and are also hidden
		while (!doc.previousSibling().isPresent()
		       && !doc.nextSibling().isPresent()
		       && doc.parent().isPresent()){
			let cssprops = doc.current().props.cssprops;
			if(cssprops ? !("hidden" === cssprops.visibility) : false) {
				break;
			}   
			doc.markCurrentForRemoval();
		}
		return doc;
	}

	private static markupPageBreak(
			doc:BoxTreeWalker,
	        size:number){
		Transformation.assertThat(doc.current().isBlockAndHasNoBlockChildren());
		Transformation.assertThat(size === 1);
		doc.renameCurrent(Transformation.DIV, Transformation.EPUB_TYPE_PAGEBREAK);
		return doc;
	}


	static WHITE_SPACE = new RegExp("\\s*").compile();
	/*
	 * Remove all the em from this box if all text boxes in this box are a descendant of em.
	 *
	 * Can also be used for strong, small etc. instead of em.
	 */
	private static removeEmInAllEmBox(
			doc:BoxTreeWalker,
	        emElement:QName ) {
		let box = doc.subTree();
		let allStrong = true;
		while (true) {
			let name = box.current().getName();
			if (!(name ? emElement.equals(name) : false)) {

				if (box.current().hasText()
				    	&& !Transformation.WHITE_SPACE.test(box.current().props.text!)) {
					allStrong = false;
					break;
				}
				if (box.firstChild().isPresent())
					continue;
			}
			if (box.firstFollowing().isPresent())
				continue;
			break;
		}
		if (allStrong) {
			box.root();
			let filter = (b?:Box) => {
				let name = b ? b.getName() : undefined;
				return name ? emElement.equals(name) : false;
			}
			Transformation.unwrapAll(box, filter);
		}
		return doc;
	}


	

	/*
	 * Count number of boxes within the current element (including the element itself) that pass filter
	 */
	private static count( tree:BoxTreeWalker, filter:(b?:Box)=>boolean) {
		tree = tree.subTree();
		let count = 0;
		if (filter(tree.current())) count++;
		while (tree.firstDescendant(filter).isPresent() || tree.firstFollowing(filter).isPresent())
			count++;
		return count;
	}

	private static unwrapAll(doc:BoxTreeWalker, select:(b?:Box)=>boolean) {
		let subtree = doc.subTree();
		while (true) {
			let current = subtree.current();
			if (select(current))
				if (subtree.firstChild().isPresent()) {
					subtree.unwrapParent();
					continue;
				} else if (subtree.previousSibling().isPresent()) {
					subtree.unwrapNextSibling();
					if (subtree.firstFollowing().isPresent())
						continue;
					else
						break;
				} else if (subtree.parent().isPresent())
					subtree.unwrapFirstChild();
				else
					break;
			if (subtree.firstChild().isPresent() || subtree.firstFollowing().isPresent())
				continue;
			else
				break;
		}
		return doc;
	}

	/* Manipulate the tree so that on return current box contains exactly the specified blocks. If
	 * needed, insert a new anonymous box. */
	private static wrapIfNeeded(doc:BoxTreeWalker, blockCount:number) {
		Transformation.assertThat(doc.current().isBlockAndHasNoBlockChildren());
		// find box that contains exactly the specified blocks, or if it doesn't exist find the first child box
		let firstBoxBlockCount = 1;
		while (true) {
			let tmp = doc.clone();
			if (tmp.previousSibling().isPresent())
				break;
			if (tmp.parent().isPresent()) {
				let k = Transformation.count(tmp, BoxFilter.isBlockAndHasNoBlockChildren);
				if (k <= blockCount) {
					doc = tmp;
					firstBoxBlockCount = k;
				} else
					break;
			} else
					break;
		}
		if (blockCount === firstBoxBlockCount)
			return doc;
		blockCount -= firstBoxBlockCount;
		// find other child boxes
		let boxCount = 1;
		while (blockCount > 0) {
			Transformation.assertThat(doc.nextSibling().isPresent());
			blockCount -= Transformation.count(doc, BoxFilter.isBlockAndHasNoBlockChildren);
			boxCount++;
		}
		Transformation.assertThat(blockCount === 0);
		for (let k = boxCount; k > 1; k--) doc.previousSibling();
		// wrap inside anonymous box
		if (doc.previousSibling().isPresent()) {
			doc.wrapNextSiblings(boxCount, new QName({localPart:""}));
			doc.nextSibling();
		} else {
			doc.parent();
			doc.wrapFirstChildren(boxCount, new QName({localPart:""}));
			doc.firstChild();
		}
		return doc;
	}

}