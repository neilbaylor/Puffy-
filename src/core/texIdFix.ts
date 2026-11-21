/**
 * Phaser 4 draws pictures from several textures in one go, each corner of a picture carrying the
 * number of its texture, and the graphics chip picks the texture with `id == 2.0` (exactly) for each
 * pixel. That number is blended across the picture from its corners like everything else, and on
 * some chips (the test browser's software one for sure) it comes out 1.9999999 for part of a long,
 * thin picture: that part is then drawn see-through. (Seen with the jumbotron's layers in the
 * wrestling ring: the ticker band half missing.) Here the shaders round the number first. Only the
 * text of Phaser's shaders is touched, as the graphics chip is handed them.
 */
export function roundTextureIds(gl: WebGLRenderingContext) {
  const source = gl.shaderSource.bind(gl);
  gl.shaderSource = (shader: WebGLShader, src: string) =>
    source(shader, src.split('outTexDatum == ').join('floor(outTexDatum + 0.5) == ').split('float texId = outTexDatum;').join('float texId = floor(outTexDatum + 0.5);'));
}
