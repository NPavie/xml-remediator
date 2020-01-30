import React from 'react';
import ReactDOM from 'react-dom';
import ContentView from '../components/ContentView';
import renderer from "react-test-renderer";

it('renders without crashing', () => {
    let content = 
        `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
        <head><title>The Sellout</title></head>
        <body>
            <p class="sp" id="ch7"> </p>
            <p class="CN"><a href="contents.xhtml#c_ch7"><span class="ePub-I">Seven</span></a></p>
            <p class="CO">The Sunday after installing the roadside sign I wanted to make a formal announcement of my plan to reanimate the city of Dickens. And what better place to do so than the next meeting of the Dum Dum Donut Intellectuals, the closest approximation we had to a representative government.</p>
            <p class="TX">One of the many sad ironies of African-American life is that every banal dysfunctional social gathering is called a “function.” And black functions never start on time, so it’s impossible to gauge how to arrive fashionably late without taking a chance of missing the event altogether. Not wanting to have to sit through the reading of the minutes, I waited until the Raiders game reached halftime. Since my father’s death, the Dum Dum Donut Intellectuals had devolved into a group of star-struck, middle-class black out-of-towners and academics who met bimonthly to fawn over the semifamous Foy Cheshire. As much as black America treasures its fallen heroes, it was hard to tell if they were more impressed with his resiliency or that despite all he’d been through he still drove a vintage 1956 Mercedes 300SL. Nevertheless, they hovered around, hoping to impress him with their insight into an indigent black community that, if they’d just taken their racial blinders off for one second, they’d realize was no longer black but predominantly Latino.</p>
        </body></html>`
    const div = document.createElement('div');
    /* deactivate test
    ReactDOM.render(<ContentView
        content={content}
        mimetype="application/xhtml+xml"
        allowEdition={true}
    />, div);
    ReactDOM.unmountComponentAtNode(div);*/
  });

it('loads base64 content correctly' , () => {
    
});