import React from 'react';

// Documents
import input_document from "./resources/box_test_input.json";

//import rename_test_document from "./resources/box_test_copy_rename.json";

import { Box, ContentCSS, BoxType } from '../components/Box';
import QName from '../components/QName';

it('parses a json document without errors', () => {
    Box.parse(JSON.stringify(input_document));
});

it('iterates over children',() => {
    let test_box = Box.parse(JSON.stringify(input_document));

    let i = 0;
    for(const child of test_box.children){
        expect(child).toBe(test_box.props.children[i]);
        i++;
    }

});

it('copy with new name',()=>{
    let test_box = Box.parse(JSON.stringify(input_document));
    //let expected_result = Box.parse()
    let test_copy = test_box.copy({
        name:new QName({
            namespace: "http://daisy/test",
            localPart: "renamed"})});

    expect(test_copy.props.name?.localPart).toBe("renamed");
    expect(test_copy.key).toBe("/renamed[0]");
    let i = 0;
    for(let child of test_copy.children){
        expect(child.key).toBe(`/renamed[0]/container[${i++}]`);
    }

});

it('copy with new attributes',() => {

});