define( [
    'osg/Utils',
    'osg/StateAttribute',
    'osg/Vec4'
], function ( MACROUTILS, StateAttribute, Vec4 ) {

    'use strict';

    /**
     *  Manage BlendColor attribute
     *  @class BlendColor
     */
    var BlendColor = function ( color ) {
        StateAttribute.call( this );
        this._constantColor = Vec4.create();
        Vec4.set( 1.0, 1.0, 1.0, 1.0, this._constantColor );
        if ( color !== undefined ) {
            this.setConstantColor( color );
        }
    };

    /** @lends BlendColor.prototype */
    BlendColor.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInherit( StateAttribute.prototype, {
        attributeType: 'BlendColor',
        cloneType: function () {
            return new BlendColor();
        },
        setConstantColor: function ( color ) {
            Vec4.copy( color, this._constantColor );
        },
        getConstantColor: function () {
            return this._constantColor;
        },
        apply: function ( state ) {
            var gl = state.getGraphicContext();
            gl.blendColor( this._constantColor[ 0 ],
                this._constantColor[ 1 ],
                this._constantColor[ 2 ],
                this._constantColor[ 3 ] );
            this._dirty = false;
        }
    } ), 'osg', 'BlendColor' );

    return BlendColor;
} );
