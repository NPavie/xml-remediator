
import React from 'react';

import input_json from './resources/document.json';
import Transformer from '../components/Transformer';
import BoxFragment from '../components/BoxFragment';
import { Box } from '../components/Box';

let doc = Box.parse(JSON.stringify(input_json));
let range = new BoxFragment({block:0},3);

it('replace tables by divs', () => {

    let transformation_chain = new Transformer(doc)
            .moveTo(range.block,
                    range.size,
                    range.inline)
            .transformTable(true)
    
    let result_keys = transformation_chain.get().getKeys();
    
    expect(result_keys[2]).toBe('/html[0]/body[0]/div[0]');
    expect(result_keys[3]).toBe('/html[0]/body[0]/div[0]/div[0]');
    expect(result_keys[4]).toBe('/html[0]/body[0]/div[0]/div[0]/a[0]');
    expect(result_keys[5]).toBe('/html[0]/body[0]/div[0]/div[0]/em[1]');
    expect(result_keys[6]).toBe('/html[0]/body[0]/div[0]/div[1]');
    expect(result_keys[7]).toBe('/html[0]/body[0]/div[0]/div[1]/img[0]');
    expect(result_keys[8]).toBe('/html[0]/body[0]/div[0]/div[2]');
    expect(result_keys[9]).toBe('/html[0]/body[0]/div[0]/div[2]/strong[0]');
    
    
    
});

it('replace tables by a heading',() => {
    
    let transformation_chain = new Transformer(doc)
            .moveTo(range.block,
                    range.size,
                    range.inline)
            .transformTable(true)
            .markupHeading(Transformer.H1);

    let result_keys = transformation_chain.get().getKeys();
    
    expect(result_keys[2]).toBe('/html[0]/body[0]/h1[0]');
    expect(result_keys[4]).toBe('/html[0]/body[0]/h1[0]/a[0]');
    expect(result_keys[5]).toBe('/html[0]/body[0]/h1[0]/text()[1]');
    expect(result_keys[7]).toBe('/html[0]/body[0]/h1[0]/img[2]');
    expect(result_keys[9]).toBe('/html[0]/body[0]/h1[0]/text()[3]');

});




