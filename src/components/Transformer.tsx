
import { Box } from "./Box";
import BoxTreeWalker, { BoxFilter } from "./BoxTreeWalker";
import QName, { QNameInterface } from './QName';
import CanNotPerformTransformerException from "./exceptions/CanNotPerformTransformationException";
import BoxFragment from "./BoxFragment";



/**
 * Transformer to apply on the input range of a given doc
 */
export default class Transformer {

	public static readonly HTML_NS = "http://www.w3.org/1999/xhtml";
	public static readonly EPUB_NS = "http://www.idpf.org/2007/ops";
	public static readonly DIV = new QName({ namespace: Transformer.HTML_NS, localPart: "div" });
	public static readonly P = new QName({ namespace: Transformer.HTML_NS, localPart: "p" });
	public static readonly SPAN = new QName({ namespace: Transformer.HTML_NS, localPart: "span" });
	public static readonly STRONG = new QName({ namespace: Transformer.HTML_NS, localPart: "strong" });
	public static readonly EM = new QName({ namespace: Transformer.HTML_NS, localPart: "em" });
	public static readonly SMALL = new QName({ namespace: Transformer.HTML_NS, localPart: "small" });
	public static readonly IMG = new QName({ namespace: Transformer.HTML_NS, localPart: "img" });
	public static readonly LI = new QName({ namespace: Transformer.HTML_NS, localPart: "li" });
	public static readonly UL = new QName({ namespace: Transformer.HTML_NS, localPart: "ul" });
	public static readonly OL = new QName({ namespace: Transformer.HTML_NS, localPart: "ol" });
	public static readonly A = new QName({ namespace: Transformer.HTML_NS, localPart: "a" });
	public static readonly HREF = new QName({ namespace: "", localPart: "href" });
	public static readonly FIGURE = new QName({ namespace: Transformer.HTML_NS, localPart: "figure" });
	public static readonly FIGCAPTION = new QName({ namespace: Transformer.HTML_NS, localPart: "figcaption" });
	public static readonly H1 = new QName({ namespace: Transformer.HTML_NS, localPart: "h1" });
	public static readonly H2 = new QName({ namespace: Transformer.HTML_NS, localPart: "h2" });
	public static readonly H3 = new QName({ namespace: Transformer.HTML_NS, localPart: "h3" });
	public static readonly H4 = new QName({ namespace: Transformer.HTML_NS, localPart: "h4" });
	public static readonly H5 = new QName({ namespace: Transformer.HTML_NS, localPart: "h5" });
	public static readonly H6 = new QName({ namespace: Transformer.HTML_NS, localPart: "h6" });

	private static readonly EPUB_TYPE_Z3998_POEM: Map<QName, string> = new Map<QName, string>([
		[new QName({ namespace: Transformer.EPUB_NS, localPart: "type" }), "z3998:poem"]
	]);
	private static readonly EPUB_TYPE_PAGEBREAK: Map<QName, string> = new Map<QName, string>([
		[new QName({ namespace: Transformer.EPUB_NS, localPart: "type" }), "pagebreak"]
	]);


	private doc: BoxTreeWalker;
	private root: BoxTreeWalker;
	private transformedFragment: BoxFragment;

	constructor(doc: Box) {
		this.root = new BoxTreeWalker(doc);
		//console.log(this.root);
		this.doc = this.root.subTree();
		//console.log(this.doc);
		this.transformedFragment = new BoxFragment({block:0});


	}

	static assertThat(test: boolean, message?: string) {
		if (!test) throw new CanNotPerformTransformerException(message);
	}

	get() {
		// Hack to check and solve an issue with reference update
		// Will be deleted if the problem does not appear anymore
		if(this.doc._root !== this.root.current()){
			console.log("warning, root is out of sync with document, resyncing.")
			this.doc.root();
			this.root = this.doc;
			this.doc = this.root.subTree();
		}
		return this.root.current();
	}

	/** Positioning in the document **/

	/**
	 * Change the fragment cursor on which the next transformation should be applied
	 * @param startBlockIndex 
	 * @param size 
	 * @param startInlineIndex 
	 */
	moveTo(startBlockIndex: number, size: number = 1, startInlineIndex: number = -1) {
		this.transformedFragment = new BoxFragment({block:startBlockIndex, inline:startInlineIndex}, size);
		return this;
	}

	/**
	 * Position a document cursor on a specific fragment
	 * @param doc document to transformed
	 * @param fragment fragment of the document to apply transformations on
	 */
	moveToRange(doc: BoxTreeWalker, fragment: BoxFragment) {
		Transformer.assertThat(fragment != null);
		doc.root();
		let n = fragment.block;
		if (doc.current().isBlockAndHasNoBlockChildren())
			Transformer.assertThat(n === 0);
		else {
			doc = Transformer.moveNBlocks(doc, n + 1);
			if (fragment.inline >= 0) {
				let isReplacedElementOrTextBox = (b?: Box) => {
					return b ? (b.hasText() || b.isReplacedElement()) : false;
				};
				let c = Transformer.count(doc, isReplacedElementOrTextBox);
				Transformer.assertThat(fragment.inline < c, `${fragment.inline} < ${c}`);
				Transformer.assertThat(doc.firstDescendant(BoxFilter.isReplacedElementOrTextBox).isPresent());
				for (let i = 0; i < fragment.inline; ++i) {
					Transformer.assertThat(doc.firstFollowing(BoxFilter.isReplacedElementOrTextBox).isPresent());
				}
			}
		}
		return doc;
	}


    /**
	 * move the doc to the next n block (or previous if n is negative)
	 * @param doc 
	 * @param n 
	 */
	private static moveNBlocks(doc: BoxTreeWalker, n: number) {
		if (n > 0) {
			if (doc.firstDescendant(BoxFilter.isBlockAndHasNoBlockChildren).isPresent()) {
				n--;
			}
			while (n-- > 0) {
				Transformer.assertThat(doc.firstFollowing(BoxFilter.isBlockAndHasNoBlockChildren).isPresent());
			}
		} else if (n < 0) {
			if (doc.firstParent(BoxFilter.isBlockAndHasNoBlockChildren).isPresent()) n++;
			while (n++ < 0) Transformer.assertThat(doc.firstPreceding(BoxFilter.isBlockAndHasNoBlockChildren).isPresent());
		}
		return doc;
	}

	/** Tables transformations **/

	/**
	 * 
	 * @param singleRow 
	 */
	transformTable(singleRow: boolean) {
		this.doc = this.moveToRange(this.doc, this.transformedFragment);
		this.doc = Transformer.transformTable(this.doc, this.transformedFragment.size, singleRow);
		
		return this;
	}

    /**
	 * @param blockCount number of blocks in table (one or more)
	 */
	private static transformTable( doc: BoxTreeWalker, blockCount: number, singleRow: boolean) {
		Transformer.assertThat(doc.current().isBlockAndHasNoBlockChildren());
		while (true) {
			Transformer.assertThat(!doc.previousSibling().isPresent());
			let props = doc.current().props.cssprops;
			if (props && props.display === "table-cell")
				break;
			else {
				Transformer.assertThat(!(props ? props.display === "block" : false));
				Transformer.assertThat(doc.parent().isPresent());
			}
		}
		doc.renameCurrent(Transformer.DIV);
		// check that this is the first cell in the row
		Transformer.assertThat(!doc.previousSibling().isPresent());
		//  rename other cells in this row
		while (doc.nextSibling().isPresent()) {
			let props = doc.current().props.cssprops;
			Transformer.assertThat(props ? props.display === "table-cell" : false);
			doc.renameCurrent(Transformer.DIV);
		}
		// rename row
		Transformer.assertThat(doc.parent().isPresent());
		let props = doc.current().props.cssprops;
		Transformer.assertThat(props ? props.display === "table-row" : false);
		doc.renameCurrent(Transformer.DIV);
		// check that this is the first row in the table (or tbody)
		Transformer.assertThat(!doc.previousSibling().isPresent());
		if (singleRow) Transformer.assertThat(!doc.nextSibling().isPresent());
		else { // process other rows
			while (doc.nextSibling().isPresent()) {
				props = doc.current().props.cssprops;
				Transformer.assertThat(props ? props.display === "table-row" : false);
				doc.renameCurrent(Transformer.DIV);
				Transformer.assertThat(doc.firstChild().isPresent());
				doc.renameCurrent(Transformer.DIV);
				while (doc.nextSibling().isPresent()) {
					props = doc.current().props.cssprops;
					Transformer.assertThat(props ? props.display === "table-cell" : false);
					doc.renameCurrent(Transformer.DIV);
				}
				doc.parent();
			}
		}
		Transformer.assertThat(doc.parent().isPresent());
		// find table
		props = doc.current().props.cssprops;
		if (props ? props.display === "table-row-group" : false) {
			// check that there is only one tbody and no thead or tfoot
			Transformer.assertThat(!doc.nextSibling().isPresent());
			Transformer.assertThat(!doc.previousSibling().isPresent());
			Transformer.assertThat(doc.parent().isPresent());
		}
		props = doc.current().props.cssprops;
		Transformer.assertThat(props ? props.display === "table" : false);
		// check number of cells in table
		let counter = Transformer.count(doc, BoxFilter.isBlockAndHasNoBlockChildren);
		Transformer.assertThat(counter === blockCount,`${counter} === ${blockCount}`);
		// unwrap table
		doc.firstChild();
		doc.unwrapParent();
		return doc;
	}


	markupHeading(headingElement: QName | QNameInterface) {
		this.doc = this.moveToRange(this.doc, this.transformedFragment!);
		this.doc = Transformer.markupHeading(
			this.doc,
			this.transformedFragment.size, -1,
			headingElement as QName);
		return this;
	}

	private static markupHeading(doc: BoxTreeWalker, blockCount: number, indexOfHeading: number, headingElement: QName, headerElement?: QName) {
		
		Transformer.assertThat(doc.current().isBlockAndHasNoBlockChildren());
		if (indexOfHeading >= 0) {
			doc = Transformer.moveNBlocks(doc, indexOfHeading);
			// move to parent block if no siblings
			doc = Transformer.wrapIfNeeded(doc, 1);
		} else {
			// find ancestor that contains the specified number of blocks, or create it
			doc = Transformer.wrapIfNeeded(doc, blockCount);
		}
		// rename to heading
		doc.renameCurrent(headingElement);
		//console.log(doc.root().getKeys());
		// remove strong, em and small within the heading
		doc = Transformer.removeEmInAllEmBox(doc, Transformer.STRONG);
		doc = Transformer.removeEmInAllEmBox(doc, Transformer.EM);
		doc = Transformer.removeEmInAllEmBox(doc, Transformer.SMALL);
		// remove all div and p within the heading
		
		// remove all span within the heading
		let h = doc.subTree();
		let isDivOrPOrSpan = (b?: Box) => {
			if (b && b.getName())
				return Transformer.DIV.equals(b.getName()!)
					|| Transformer.P.equals(b.getName()!)
					|| Transformer.SPAN.equals(b.getName()!);
			else return false;
		}
		while (h.firstDescendant(isDivOrPOrSpan).isPresent() || h.firstFollowing(isDivOrPOrSpan).isPresent()) {
			if (!Transformer.SPAN.equals(h.current().getName()!))
				h.renameCurrent(Transformer.SPAN);
			h.markCurrentForUnwrap();
		}
		
		if (indexOfHeading >= 0 && headerElement != null) {
			doc = Transformer.moveNBlocks(doc, - indexOfHeading);
			// find ancestor that contains the specified number of blocks, or create it
			Transformer.assertThat(blockCount > 1);
			doc = Transformer.wrapIfNeeded(doc, blockCount);
			// rename to header
			doc.renameCurrent(headerElement);
			// make sure there is only one heading inside the header
			let header = doc.subTree();
			header.firstDescendant(BoxFilter.isBlockAndHasNoBlockChildren);
			do {
				if (indexOfHeading-- !== 0) {
					let name = header.current().getName();
					if (name && (Transformer.H1.equals(name)
						|| Transformer.H2.equals(name)
						|| Transformer.H3.equals(name)
						|| Transformer.H4.equals(name)
						|| Transformer.H5.equals(name)
						|| Transformer.H6.equals(name)))
						header.renameCurrent(Transformer.P);
				}
			} while (header.firstFollowing(BoxFilter.isBlockAndHasNoBlockChildren).isPresent());
		}
		return doc;
	}

	removeImage() {
		this.doc = this.moveToRange(this.doc, this.transformedFragment);
		this.doc = Transformer.removeImage(this.doc, this.transformedFragment.size);
		return this;
	}

	private static removeImage(doc: BoxTreeWalker, size: number) {
		Transformer.assertThat(size === 1);
		let name = doc.current().getName();
		Transformer.assertThat(name ? Transformer.IMG.equals(name) : false);
		Transformer.assertThat(doc.current().isReplacedElement());
		doc.markCurrentForRemoval();
		// also remove parent elements that have no other content than the img
		while (!doc.previousSibling().isPresent()
			&& !doc.nextSibling().isPresent()
			&& doc.parent().isPresent())
			doc.markCurrentForRemoval();
		return doc;
	}

	private static convertToList(doc: BoxTreeWalker, blockCount: number, listElement: QName, listAttributes: Map<QName, string>, listItemElement: QName) {
		Transformer.assertThat(doc.current().isBlockAndHasNoBlockChildren());
		// find ancestor that contains the specified number of blocks, or create it
		doc = Transformer.wrapIfNeeded(doc, blockCount);
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

	private static convertToPoem(doc: BoxTreeWalker, blockCount: number) {
		return Transformer.convertToList(doc,
			blockCount,
			Transformer.DIV,
			Transformer.EPUB_TYPE_Z3998_POEM,
			Transformer.P);
	}

	private static transformNavList(doc: BoxTreeWalker, blockCount: number) {
		Transformer.assertThat(doc.current().isBlockAndHasNoBlockChildren());
		// find root list element
		let listBlockCount = 1;
		while (true) {
			let tmp = doc.clone();
			if (!tmp.previousSibling().isPresent()
				&& tmp.parent().isPresent()
				&& (listBlockCount = Transformer.count(tmp, BoxFilter.isBlockAndHasNoBlockChildren)) <= blockCount) {
				doc = tmp;
				let name = doc.current().getName();
				if (listBlockCount === blockCount && (name ? Transformer.OL.equals(name) : false))
					break;
			} else
				Transformer.assertThat(false);
		}
		// process items
		let apply = ((ol: BoxTreeWalker) => {
			Transformer.assertThat(ol.firstChild().isPresent());
			do {
				let name = ol.current().getName();
				Transformer.assertThat(name ? Transformer.LI.equals(name) : false);
				Transformer.assertThat(ol.firstChild().isPresent());
				let childCount = 1;
				while (ol.nextSibling().isPresent()) childCount++;
				name = ol.current().getName();
				if (childCount === 1 && (name ? Transformer.A.equals(name) : false) && ol.current().getAttributes().has(Transformer.HREF)) {
					ol.parent();
					continue;
				}
				name = ol.current().getName();
				if (name ? Transformer.OL.equals(name) : false) {
					if (childCount === 1)
						Transformer.assertThat(false);
					// process nested list
					ol = apply(ol);
					if (childCount === 2) {
						ol.previousSibling();
						name = ol.current().getName();
						if ((name ? Transformer.A.equals(name) : false) && ol.current().getAttributes().has(Transformer.HREF)) {
							ol.parent();
							continue;
						}
					} else {
						ol.parent();
						ol.wrapFirstChildren(childCount - 1, Transformer.SPAN);
						childCount = 2;
						ol.firstChild();
					}
				} else if (childCount > 1) {
					ol.parent();
					ol.wrapChildren(Transformer.SPAN);
					childCount = 1;
					ol.firstChild();
				}
				// find first descendant a
				let span = ol.subTree();
				let isAWithHref = (b?: Box) => {
					let name = b ? b.getName() : undefined;
					return (name ? Transformer.A.equals(name) : false) && (b ? b.getAttributes().has(Transformer.HREF) : false);
				};
				if (!span.firstDescendant(isAWithHref).isPresent())
					if (childCount === 2) {
						ol.parent();
						continue;
					} else
						Transformer.assertThat(false);
				let a = span.current();
				let href = a.getAttributes().get(Transformer.HREF);
				// remove this a and all other a with the same href
				span.root();
				let isAwithFoundHref = (b?: Box) => {
					let name = b ? b.getName() : undefined;
					return (name ? Transformer.A.equals(name) : false) && (b ? href === b.getAttributes().get(Transformer.HREF) : false);
				};
				span = Transformer.unwrapAll(span, isAwithFoundHref);
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
		let isDivOrP = (b?: Box) => {
			let name = b ? b.getName() : undefined;
			return name ? Transformer.DIV.equals(name) || Transformer.P.equals(name) : false;
		};
		while (toc.firstDescendant(isDivOrP).isPresent() || toc.firstFollowing(isDivOrP).isPresent()) {
			toc.renameCurrent(Transformer.SPAN);
			toc.markCurrentForUnwrap();
		}
		return doc;
	}

	private static wrapList(doc: BoxTreeWalker, blockCount: number, preContentBlockCount: number, wrapper: QName) {
		Transformer.assertThat(doc.current().isBlockAndHasNoBlockChildren());
		doc = Transformer.moveNBlocks(doc, preContentBlockCount);
		// find list element
		let listBlockCount = 1;
		while (true) {
			let tmp = doc.clone();
			if (!tmp.previousSibling().isPresent()
				&& tmp.parent().isPresent()) {
				listBlockCount = Transformer.count(tmp, BoxFilter.isBlockAndHasNoBlockChildren);
				if (listBlockCount <= (blockCount - preContentBlockCount)) {
					doc = tmp;
					let name = doc.current().getName();
					if (listBlockCount === (blockCount - preContentBlockCount)
						&& (name ? Transformer.OL.equals(name) || Transformer.UL.equals(name) : false))
						break;
				}
			} else
				Transformer.assertThat(false);
		}
		let listHasNextSibling = doc.nextSibling().isPresent();
		if (listHasNextSibling)
			doc.previousSibling();
		// find elements belonging to pre-content
		let childrenCount = 1;
		if (preContentBlockCount > 0) {
			while (doc.previousSibling().isPresent()) {
				childrenCount++;
				preContentBlockCount -= Transformer.count(doc, BoxFilter.isBlockAndHasNoBlockChildren);
				if (preContentBlockCount <= 0) break;
			}
			Transformer.assertThat(preContentBlockCount === 0);
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
			Transformer.assertThat(doc.parent().isPresent());
			let name = doc.current().getName();
			if (!(name ? wrapper.equals(name) : false))
				if (name ? Transformer.DIV.equals(name) : false)
					doc.renameCurrent(wrapper);
				else {
					doc.wrapChildren(wrapper);
					doc.firstChild();
				}
		}
		return doc;
	}

	private static wrapListInPrevious(doc: BoxTreeWalker, blockCount: number) {
		doc = Transformer.wrapList(doc, blockCount, 1, new QName({ localPart: "_" }));
		let wrapper = doc.firstChild().value!.getName()!;
		doc.renameCurrent(new QName({ localPart: "" }));
		doc.parent();
		doc.renameCurrent(wrapper);
		return doc;
	}

	private static wrapInFigure(doc: BoxTreeWalker, blockCount: number, captionBlockCount: number, captionBefore: boolean) {
		Transformer.assertThat(doc.current().isBlockAndHasNoBlockChildren());
		Transformer.assertThat(blockCount > captionBlockCount);
		if (captionBlockCount > 0) {
			if (!captionBefore)
				doc = Transformer.moveNBlocks(doc, blockCount - captionBlockCount);
			doc = Transformer.wrapIfNeeded(doc, captionBlockCount);
			doc.renameCurrent(Transformer.FIGCAPTION);
			doc = Transformer.removeEmInAllEmBox(doc, Transformer.STRONG);
			doc = Transformer.removeEmInAllEmBox(doc, Transformer.EM);
			doc = Transformer.removeEmInAllEmBox(doc, Transformer.SMALL);
			if (!captionBefore)
				doc = Transformer.moveNBlocks(doc, captionBlockCount - blockCount);
			else if (!doc.current().isBlockAndHasNoBlockChildren())
				doc.firstDescendant(BoxFilter.isBlockAndHasNoBlockChildren);
		}
		doc = Transformer.wrapIfNeeded(doc, blockCount);
		doc.renameCurrent(Transformer.FIGURE);
		if (blockCount - captionBlockCount === 1 && captionBlockCount !== 0) {
			doc.firstChild();
			doc.nextSibling();
			let name = doc.current().getName();
			if (name ? Transformer.DIV.equals(name) || Transformer.P.equals(name) : false)
				doc.markCurrentForUnwrap();
		}
		return doc;
	}

	private static removeHiddenBox(doc: BoxTreeWalker, size: number) {
		Transformer.assertThat(doc.current().isBlockAndHasNoBlockChildren());
		Transformer.assertThat(size === 1);
		let cssprops = doc.current().props.cssprops;
		Transformer.assertThat(cssprops ? "hidden" === cssprops.visibility : false);
		// check that all contained boxes inherit visibility
		let box = doc.subTree();

		while (box.firstChild().isPresent() || box.firstFollowing().isPresent()) {
			cssprops = box.current().props.cssprops;
			Transformer.assertThat(cssprops ? "hidden" === cssprops.visibility : false);
		}

		// remove
		doc.markCurrentForRemoval();
		// also remove parent elements that have no other content than the current box and are also hidden
		while (!doc.previousSibling().isPresent()
			&& !doc.nextSibling().isPresent()
			&& doc.parent().isPresent()) {
			let cssprops = doc.current().props.cssprops;
			if (cssprops ? !("hidden" === cssprops.visibility) : false) {
				break;
			}
			doc.markCurrentForRemoval();
		}
		return doc;
	}

	private static markupPageBreak(doc: BoxTreeWalker, size: number) {
		Transformer.assertThat(doc.current().isBlockAndHasNoBlockChildren());
		Transformer.assertThat(size === 1);
		doc.renameCurrent(Transformer.DIV, Transformer.EPUB_TYPE_PAGEBREAK);
		return doc;
	}


	static WHITE_SPACE = new RegExp(/\s/g).compile();
	/**
	 * Remove all the em from this box if all text boxes in this box are a descendant of em.
	 *
	 * Can also be used for strong, small etc. instead of em.
	 */
	private static removeEmInAllEmBox(doc: BoxTreeWalker, emElement: QName) {
		let box = doc.subTree();
		let allStrong = true;
		let keep_searching = true;
		while (keep_searching) {
			if (!emElement.equals(box.current().getName())) {
				if (box.current().hasText() 
						&& !Transformer.WHITE_SPACE.test(box.current().props.text!)) {
					allStrong = false;
					keep_searching = false;
				}
				if (box.firstChild().isPresent())
					continue;
			}
			if (box.firstFollowing().isPresent())
				continue;
			keep_searching = false;
		}
		if (allStrong) {
			box.root();
			Transformer.unwrapAll(box, (b: Box) => {
					return emElement.equals(b.getName());
				});
		}
		return doc;
	}




	/**
	 * Count number of boxes within the current element (including the element itself) that pass filter
	 */
	private static count(tree: BoxTreeWalker, filter: (b?: Box) => boolean) {
		let _tree = tree.subTree();
		let count = 0;
		if (filter(_tree.current())) count++;
		while (_tree.firstDescendant(filter).isPresent() || _tree.firstFollowing(filter).isPresent())
			count++;
		return count;
	}

	/**
	 * unwrap all elements of the ocument that are filtered by a selector function
	 * @param doc 
	 * @param select 
	 */
	private static unwrapAll(doc: BoxTreeWalker, select: (b: Box) => boolean) {
		let subtree = doc.subTree();
		let keep_searching = true;
		while (keep_searching) {
			let current = subtree.current();
			if (select(current)) {
				if (subtree.firstChild().isPresent()) {
					subtree.unwrapParent();
					continue;
				} else if (subtree.previousSibling().isPresent()) {
					subtree.unwrapNextSibling();
					if (subtree.firstFollowing().isPresent()) continue;
					else keep_searching = false;
				} else if (subtree.parent().isPresent()) {
					subtree.unwrapFirstChild();
				} else keep_searching = false;
			} else {
				// Try to select a child or the next following box in the tree
				if (subtree.firstChild().isPresent() || subtree.firstFollowing().isPresent()) continue;
				else keep_searching = false; // end of the boxes list if no child or remaining nodes
			}
		}
		return doc;
	}

	/**
	 * Manipulate the tree so that on return current box contains exactly the specified blocks. If
	 * needed, insert a new anonymous box. 
	 */
	private static wrapIfNeeded(doc: BoxTreeWalker, blockCount: number) {
		Transformer.assertThat(doc.current().isBlockAndHasNoBlockChildren());
		// find box that contains exactly the specified blocks, or if it doesn't exist find the first child box
		let firstBoxBlockCount = 1;
		while (true) {
			let tmp = doc.clone();
			if (tmp.previousSibling().isPresent())
				break;
			if (tmp.parent().isPresent()) {
				let k = Transformer.count(tmp, BoxFilter.isBlockAndHasNoBlockChildren);
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
			Transformer.assertThat(doc.nextSibling().isPresent());
			blockCount -= Transformer.count(doc, BoxFilter.isBlockAndHasNoBlockChildren);
			boxCount++;
		}
		Transformer.assertThat(blockCount === 0);
		for (let k = boxCount; k > 1; k--) doc.previousSibling();
		// wrap inside anonymous box
		if (doc.previousSibling().isPresent()) {
			doc.wrapNextSiblings(boxCount, new QName({ localPart: "" }));
			doc.nextSibling();
		} else {
			doc.parent();
			doc.wrapFirstChildren(boxCount, new QName({ localPart: "" }));
			doc.firstChild();
		}
		return doc;
	}



	/**
	 * Retrieve the keys of the elements selected by a BoxFragmenet
	 * @param doc root box of the document to be 
	 * @param frag 
	 */
	public static getFragmentKeys(doc:Box,frag:BoxFragment){
		let temp = new BoxTreeWalker(doc);

		
	}
	

}