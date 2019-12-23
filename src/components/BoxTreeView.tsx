import React from "react";

import { Box } from "./Box";

interface BoxTreeProperties {
    root_box:Box;
}

export default class BoxTreeView extends React.Component<BoxTreeProperties>{
    
    constructor(props:BoxTreeProperties){
        super(props);

    }

    render(){
        return <p>BoxTreeView</p>;
    }
}