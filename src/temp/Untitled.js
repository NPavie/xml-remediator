
/*
function QName(from) {
	this.namespace = from.namespace;
	this.localPart = from.localPart;
	this.prefix = from.prefix;
}

class ListIterator {
	constructor(from) {
		this.supplier = from.supplier;
		this.list = from.list || [];
		this.index = from.index || 0;
		this.done = from.done || false;
	}
	hasNext() {
		if (this.index < this.list.length)
			return true;
		if (this.done)
			return false;
		var next = this.supplier.next();
		if (next.done) {
			this.done = true;
			return false;
		} else {
			this.list.push(next.value);
			return true;
		}
	}
	hasPrevious() {
		return this.index > 0;
	}
	next() {
		if (!this.hasNext())
			return {done: true};
		else
			return {
				done: false,
				value: this.list[this.index++]};
	}
	previous() {
		if (!this.hasPrevious())
			return {done: true};
		else
			return {
				done: false,
				value: this.list[--this.index]};
	}
	clone() {
		return new ListIterator(this);
	}
}

var ListIterable = (function() {
	
	return {
		from: function(supplier) {
			var list = [];
			var iterable = {};
			iterable[Symbol.iterator] = function() {
				return new ListIterator({
					list: list,
					supplier: supplier});
			};
			return iterable;
		}
	};
})();

var BoxType = {
	INLINE: 0,
	BLOCK: 1
};

function RuntimeException(message) {
	this.message = message;
}

function IllegalArgumentException(message) {
	this.message = message;
}

function ConcurrentModificationException() {}

class Box {
	constructor(from) {
		this.type = from.type;
		this.name = from.name;
		this.attributes = from.attributes;
		this.text = from.text;
		if (from.childrenIterable)
			this.childrenIterable = from.childrenIterable;
		else if (from.children[Symbol.iterator])
			this.childrenIterable = ListIterable.from(from.children[Symbol.iterator]());
		else
			this.childrenIterable = ListIterable.from(from.children);
		this.props = from.props;
	}
	get children() {
		return this.childrenIterable[Symbol.iterator]();
	}
	get isBlockAndHasNoBlockChildren() {
		if (this.type == BoxType.INLINE)
			return false;
		else {
			var firstChild = this.children.next();
			if (!firstChild.done)
				return (firstChild.value.type == BoxType.INLINE)
			else
				return true;
		}
	}
	[Symbol.iterator]() {
		return this.children;
	}
	withName(name) {
		var newBox = new Box(this);
		newBox.name = name;
		Object.freeze(newBox);
		return newBox;
	}
	withChildren(children) {
		var newBox = new Box(this);
		if (children[Symbol.iterator])
			newBox.childrenIterable = ListIterable.from(children[Symbol.iterator]());
		else
			newBox.childrenIterable = ListIterable.from(children)
		if (this.type == BoxType.BLOCK) {
			var hasBlockChildren = null;
			var prevIsAnonymous = null;
			for (var c of newBox) {
				if (hasBlockChildren == null)
					hasBlockChildren = (c.type == BoxType.BLOCK);
				else if (hasBlockChildren != (c.type == BoxType.BLOCK))
					throw new IllegalArgumentException("block and inline can not be siblings");
				if (c.name == null && prevIsAnonymous == true)
					throw new IllegalArgumentException("no adjacent anonymous block boxes");
				prevIsAnonymous = (c.name == null);
			}
		} else {
			for (var c of newBox)
				if (c.type == BoxType.BLOCK)
					throw new IllegalArgumentException("no block inside inline");
		}
		Object.freeze(newBox);
		return newBox;
	}
}

var Optional = {
	of: function(value) {
		if (value != null)
			return {
				done: false,
				value: value };
		else
			return { done: true };
	}
};

var noSuchElement = Optional.of(null);

function deepCopyStack(stack) {
	return stack.map(iterable => iterable.clone());
}

function forward(iterator, toIndex) {
	while (toIndex-- > 0)
		iterator.next();
}

function rewind(iterator) {
	var i = 0;
	while (iterator.hasPrevious()) {
		iterator.previous();
		i++;
	}
	return i;
}

function consume(iterator) {
	var array = [];
	var next;
	while (!(next = iterator.next()).done)
		array.push(next.value);
	return array;
}

class BoxTreeWalker {
	constructor(root) {
		this.rootBox = root;
		this.path = [];
		this.current = root;
	}
	clone() {
		var clone = new BoxTreeWalker();
		clone.rootBox = this.rootBox;
		clone.path = deepCopyStack(this.path);
		clone.current = this.current;
	}
	subTree() {
		var fullTree = this;
		var subTree = new BoxTreeWalker(fullTree.current);
		subTree.updateRoot = function(root) {
			if (this.rootBox != fullTree.current)
				throw new ConcurrentModificationException();
			else {
				this.rootBox = root;
				fullTree.updateCurrent(root);
			}
		};
		return subTree;
	}
	parent() {
		if (this.path.length == 0)
			return noSuchElement;
		this.path.pop();
		if (this.path.length == 0)
			this.current = this.rootBox;
		else {
			var peek = this.path[this.path.length - 1];
			this.current = peek.previous().value;
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
		var siblings = this.path[this.path.length - 1];
		siblings.previous();
		if (!siblings.hasPrevious()) {
			siblings.next();
			return noSuchElement;
		}
		this.current = siblings.previous().value;
		siblings.next();
		return Optional.of(this.current);
	}
	nextSibling() {
		if (this.path.length == 0)
			return noSuchElement;
		var siblings = this.path[this.path.length - 1];
		if (!siblings.hasNext())
			return noSuchElement;
		this.current = siblings.next().value;
		return Optional.of(this.current);
	}
	firstChild() {
		var children = this.current.children;
		if (!children.hasNext())
			return noSuchElement;
		this.current = children.next().value;
		this.path.push(children);
		return Optional.of(this.current);
	}
	firstFollowing(filter) {
		if (!filter) {
			for (var i = this.path.length - 1; i >= 0 ; i--) {
				var siblings = this.path[i];
				if (siblings.hasNext()) {
					this.current = siblings.next().value;
					this.path.length = i + 1;
					return Optional.of(this.current);
				}
			}
			return noSuchElement;
		} else {
			var savePath = deepCopyStack(this.path);
			var saveCurrent = this.current;
			while (true) {
				var next;
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
	firstPreceding(filter) {
		if (!filter) {
			for (var i = this.path.length - 1; i >= 0 ; i--) {
				var siblings = path[i];
				siblings.previous();
				if (siblings.hasPrevious()) {
					this.current = siblings.previous().value;
					siblings.next();
					this.path.length = i + 1;
					while (true) {
						var children = this.current.children;
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
			var savePath = deepCopyStack(this.path);
			var saveCurrent = this.current;
			var previous;
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
	firstParent(filter) {
		for (var i = this.path.length - 2; i >= 0 ; i--) {
			var parent = this.path[i].previous().value;
			this.path[i].next();
			if (filter(parent)) {
				this.path.length = i + 1;
				this.current = parent;
				return Optional.of(this.current);
			}
		}
		if (filter(this.rootBox)) {
			this.path.length = 0;
			this.current = this.rootBox;
			return Optional.of(this.current);
		}
		return noSuchElement;
	}
	firstDescendant(filter) {
		var startDepth = this.path.length;
		while (true) {
			var next;
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
				if (filter(next.value))
					return next;
			} else
				break;
		}
		return noSuchElement;
	}
	renameCurrent(name) {
		var renamed = this.current.withName(name);
		this._updateCurrent(renamed);
		return this.current;
	}
	deleteFirstChild() {
		var children = this.current.children;
		if (!children.hasNext())
			throw new RuntimeException("there is no first child");
		children.next();
		this._updateCurrent(this.current.withChildren(children));
		return this.current;
	}
	unwrapFirstChild() {
		var children = this.current.children;
		if (!children.hasNext())
			throw new RuntimeException("there is no first child");
		var firstChild = children.next().value;
		children.previous();
		children = consume(children);
		if (firstChild.text != null)
			children[0] = firstChild.withName(null);
		else
			children = consume(firstChild.children).concat(children.slice(1));
		this._updateCurrent(this.current.withChildren(children));
		return this.current;
	}
	unwrapNextSibling() {
		if (this.path.length == 0)
			throw new RuntimeException("there is no next sibling");
		var siblings = this.path[this.path.length - 1];
		if (!siblings.hasNext())
			throw new RuntimeException("there is no next sibling");
		var parent = parent().value;
		var nextSibling = siblings.next().value;
		var i = rewind(siblings);
		siblings = consume(siblings);
		if (nextSibling.text != null)
			siblings[i - 1] = nextSibling.withName(null);
		else
			siblings = siblings.slice(0, i - 1).concat(consume(nextSibling.children)).concat(siblings.slice(i));
		this._updateCurrent(parent.withChildren(siblings));
		this.firstChild();
		while (i-- > 2) this.nextSibling();
		return this.current;
	}
	unwrapParent() {
		if (this.path.length == 0)
			throw new RuntimeException("there is no parent");
		if (this.path.length == 1)
			throw new RuntimeException("root can not be unwrapped");
		var siblings = this.path[this.path.length - 1];
		this.parent();
		var parentSiblings = this.path[this.path.length - 1];
		var i = rewind(siblings);
		var j = rewind(parentSiblings);
		parentSiblings = consume(parentSiblings);
		parentSiblings = parentSiblings.slice(0, j - 1).concat(consume(siblings)).concat(parentSiblings.slice(j));
		var newParent = this.parent().value;
		this._updateCurrent(newParent.withChildren(parentSiblings));
		this.firstChild();
		while (i-- > 1) this.nextSibling();
		while (j-- > 1) this.nextSibling();
		return this.current;
	}
	_updateRoot(newRoot) {
		this.rootBox = newRoot;
	}
	_updateCurrent(newCurrent) {
		if (this.path.length == 0)
			this._updateRoot(newCurrent);
		else {
			var newPath = [];
			var cur = newCurrent;
			while (this.path.length > 0) {
				var siblings = this.path[this.path.length - 1];
				var parent = this.parent().value;
				var i = rewind(siblings);
				siblings = consume(siblings);
				siblings[i - 1] = cur;
				cur = parent.withChildren(siblings);
				siblings = cur.children;
				forward(siblings, i);
				newPath.unshift(siblings);
			}
			this._updateRoot(cur);
			this.path = newPath;
		}
		this.current = newCurrent;
	}
}

// **********************************************************************

//class CanNotPerformTransformationException extends Error {}

var isBlockAndHasNoBlockChildren = (b => b.isBlockAndHasNoBlockChildren);

var DIV = {
	namespace: "http://www.w3.org/1999/xhtml",
	localPart: "div",
	prefix: ""
};

function assertThat(test) {
	if (!test)
		throw new CanNotPerformTransformationException();
}

function nthBlock(doc, index) {
	assertThat(!doc.firstDescendant(isBlockAndHasNoBlockChildren).done);
	for (var i = 0; i < index; i++)
		assertThat(!doc.firstFollowing(isBlockAndHasNoBlockChildren).done);
}

function count(tree, filter) {
	var count = 0;
	while (!tree.firstDescendant(filter).done || !tree.firstFollowing(filter).done)
		count++;
	return count;
}

function transformSingleRowTable(doc, firstBlockIdx, blockCount) {
	nthBlock(doc, firstBlockIdx);
	while (true) {
		assertThat(doc.previousSibling().done);
		if (doc.current.props.display == "table-cell")
			break;
		else {
			assertThat(!doc.current.props.display == "block");
			assertThat(!doc.parent().done);
		}
	}
	doc.renameCurrent(DIV);
	assertThat(doc.previousSibling().done);
	while (true) {
		if (!doc.nextSibling().done) {
			assertThat(doc.current.props.display == "table-cell");
			doc.renameCurrent(DIV);
		} else
			break;
	}
	assertThat(!doc.parent().done);
	assertThat(doc.current.props.display == "table-row");
	doc.renameCurrent(DIV);
	assertThat(doc.nextSibling().done);
	var colgroupPresent = false;
	if (!doc.previousSibling().done) {
		assertThat(doc.current.props.display == "table-column-group");
		assertThat(doc.previousSibling().done);
		colgroupPresent = true;
	}
	assertThat(!doc.parent().done);
	if (!colgroupPresent && doc.current.props.display == "table-row-group") {
		assertThat(doc.nextSibling().done);
		if (!doc.previousSibling().done) {
			assertThat(doc.current.props.display == "table-column-group");
			assertThat(doc.previousSibling().done);
			colgroupPresent = true;
		}
		assertThat(!doc.parent().done);
	}
	assertThat(doc.current.props.display == "table");
	if (colgroupPresent)
		doc.deleteFirstChild();
	doc.firstChild();
	doc.unwrapParent();
	var table = doc.subTree();
	assertThat(count(table, isBlockAndHasNoBlockChildren) == blockCount);
}

// **********************************************************************

function parse(json) {
	var box = new Box(
		JSON.parse(
			json,
			function(key, value) {
				if (key == 'children')
					return value.map(function(v) {
						var box = new Box(v);
						Object.freeze(box);
						return box;
					});
				else if (key == 'name' && value != null)
					return new QName(value);
				else
					return value;
			}
		)
	);
	Object.freeze(box);
	return box;
}
*/
/*

	private static final String HTML_NS = "http://www.w3.org/1999/xhtml";
	private static final QName H1 = new QName(HTML_NS, "h1");
	private static final QName NAV = new QName(HTML_NS, "nav");
	private static final QName OL = new QName(HTML_NS, "ol");
	private static final QName LI = new QName(HTML_NS, "li");
	
	@Test
	public void testTransformTheCodfishDreamChapter1()
		throws XMLStreamException, IOException, SaxonApiException, InterruptedException,
		       CanNotPerformTransformationException {

		URL html = BoxTreeWalkerTest.class.getResource("test.xhtml");
		Document doc = Parser.parse(html.openStream(), html);
		Box transformed = new Transformations(doc.root().getBox())
				.moveTo(0, 3)    .transformTable(true)
				                 .markupHeading(H1)
				.moveTo(1, 0, 1) .removeImage()
				.get();
		
		utils.serialize(transformed);
		utils.render(transformed, true);
		utils.render(transformed, false);
	}

	@Test
	public void testTransformTheCodfishDreamContents()
		throws XMLStreamException, IOException, SaxonApiException, InterruptedException,
		       CanNotPerformTransformationException {

		URL html = BoxTreeWalkerTest.class.getResource("test2.xhtml");
		Document doc = Parser.parse(html.openStream(), html);
		Box transformed = new Transformations(doc.root().getBox())
				.moveTo(0, 1)    .markupHeading(H1)
				.moveTo(0, 0, 1) .removeImage()
				.moveTo(1, 150)  .transformTable(false)
				                 .convertToList(OL, null, LI)
				                 .transformNavList()
				.moveTo(0, 151)  .wrapList(1, NAV)
				.get();
		
		utils.render(transformed, false);
	}
	*/