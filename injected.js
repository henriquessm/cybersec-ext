
(function(){
  function notify(){ try { window.dispatchEvent(new CustomEvent('cybersecext-canvas')); } catch(e){} }

  try {
    if (typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype) {
      const p = HTMLCanvasElement.prototype;
      if (p.toDataURL) { const _ = p.toDataURL; p.toDataURL = function(){ notify(); return _.apply(this, arguments); }; }
      if (p.toBlob)    { const _ = p.toBlob;    p.toBlob    = function(){ notify(); return _.apply(this, arguments); }; }
    }
    if (typeof CanvasRenderingContext2D !== 'undefined' && CanvasRenderingContext2D.prototype) {
      const _gid = CanvasRenderingContext2D.prototype.getImageData;
      if (_gid) CanvasRenderingContext2D.prototype.getImageData = function(){ notify(); return _gid.apply(this, arguments); };
    }
    if (typeof WebGLRenderingContext !== 'undefined' && WebGLRenderingContext.prototype && WebGLRenderingContext.prototype.readPixels) {
      const _rp = WebGLRenderingContext.prototype.readPixels;
      WebGLRenderingContext.prototype.readPixels = function(){ notify(); return _rp.apply(this, arguments); };
    }
    if (typeof WebGL2RenderingContext !== 'undefined' && WebGL2RenderingContext.prototype && WebGL2RenderingContext.prototype.readPixels) {
      const _rp2 = WebGL2RenderingContext.prototype.readPixels;
      WebGL2RenderingContext.prototype.readPixels = function(){ notify(); return _rp2.apply(this, arguments); };
    }
    if (typeof OffscreenCanvas !== 'undefined' && OffscreenCanvas.prototype) {
      if (OffscreenCanvas.prototype.convertToBlob) {
        const _ctb = OffscreenCanvas.prototype.convertToBlob;
        OffscreenCanvas.prototype.convertToBlob = function(){ notify(); return _ctb.apply(this, arguments); };
      }
      if (OffscreenCanvas.prototype.toDataURL) {
        const _tod = OffscreenCanvas.prototype.toDataURL;
        OffscreenCanvas.prototype.toDataURL = function(){ notify(); return _tod.apply(this, arguments); };
      }
    }
  } catch(e){}
})();
