import React from 'react';

import input_document from "./resources/box_test_input.json";
import { Box } from '../components/Box';
import BoxTreeWalker from '../components/BoxTreeWalker';
import QName from '../components/QName';

it('loads a box without error', () => {
    // TODO
});

it('retrieves the root',() => {
    // TODO
});

it('creates a real clone with no common references',() => {
    // TODO
});

it('get the first child',() => {
    let test_box = Box.parse(JSON.stringify(input_document));
    let walker = new BoxTreeWalker(test_box);

    walker.firstChild();
    expect(walker.current().key).toBe("/root[0]/container[0]");
});

it('get the next sibling',() => {
    let test_box = Box.parse(JSON.stringify(input_document));
    let walker = new BoxTreeWalker(test_box);

    walker.firstChild();
    walker.firstChild();
    expect(walker.current().key).toBe("/root[0]/container[0]/block[0]");
    walker.nextSibling();
    expect(walker.current().key).toBe("/root[0]/container[0]/block[1]");
});

it('get the first descendant',() => {
    let test_box = Box.parse(JSON.stringify(input_document));
    let walker = new BoxTreeWalker(test_box);

    walker.firstChild();
    expect(walker.current().key).toBe("/root[0]/container[0]");
});


it('get the first following element',() => {
    let test_box = Box.parse(JSON.stringify(input_document));
    let walker = new BoxTreeWalker(test_box);

    walker.firstChild();
    walker.firstChild();
    expect(walker.current().key).toBe("/root[0]/container[0]/block[0]");
    walker.firstFollowing();
    expect(walker.current().key).toBe("/root[0]/container[0]/block[1]");
});

it('renames the current and correctly propagate the keys',() => {
    let test_box = Box.parse(JSON.stringify(input_document));
    let walker = new BoxTreeWalker(test_box);

    walker.firstChild();
    walker.renameCurrent(new QName({
        namespace: "http://daisy/test",
        localPart: "renamed"}));

    expect(walker.current().key).toBe("/root[0]/renamed[0]");
    walker.firstChild();
    expect(walker.current().key).toBe("/root[0]/renamed[0]/block[0]");
    
});

