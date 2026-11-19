-- "Explorador Global" ya no depende de que un curso tenga 7 mundos (los cursos de otros lenguajes
-- se generan desde el silabo y pueden tener otra cantidad): cuenta mundos completados en total.
UPDATE logro
   SET descripcion = 'Completa 7 mundos en total, de cualquier curso.'
 WHERE nombre = 'Explorador Global';
