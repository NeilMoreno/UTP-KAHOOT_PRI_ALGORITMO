'use strict';

const { BUCKETS } = require('../utils/age');

// ==============================================================
// Perfil demográfico para el superadministrador.
// Solo se entregan conteos AGREGADOS por rango de edad y género. Como pueden incluir menores, los grupos
// pequeños no se publican: cualquier conteo entre 1 y 4 se oculta ("<5") y se evitan deducciones por resta:
//  - si un género de un rango queda por debajo de 5, no se entrega el desglose de ese rango;
//  - el total general solo se entrega si ningún rango quedó oculto.
// ==============================================================

const MIN_GROUP_SIZE = 5;
const GENDERS = ['femenino', 'masculino'];

const SQL = `
    SELECT CASE
               WHEN u.fecha_nacimiento IS NULL THEN 'sin_dato'
               WHEN x.edad < 12 THEN 'lt12'
               WHEN x.edad <= 14 THEN '12_14'
               WHEN x.edad <= 17 THEN '15_17'
               WHEN x.edad <= 24 THEN '18_24'
               WHEN x.edad <= 34 THEN '25_34'
               ELSE '35_plus'
           END AS rango,
           u.genero,
           count(*)::integer AS total
      FROM usuario u
      CROSS JOIN LATERAL (
          SELECT date_part('year', age((now() AT TIME ZONE 'America/Lima')::date, u.fecha_nacimiento))::integer AS edad
      ) x
     WHERE u.rol = 'estudiante'
       AND u.estado = 'activo'
       AND ($1::uuid IS NULL OR u.id_institucion = $1)
     GROUP BY 1, 2;
`;

const isSmall = (count) => count > 0 && count < MIN_GROUP_SIZE;

// Convierte las filas { rango, genero, total } en la respuesta pública con supresión de grupos pequeños.
const buildDemographics = (rows) => {
    const counts = new Map();
    for (const row of rows) {
        const entry = counts.get(row.rango) || { total: 0, femenino: 0, masculino: 0 };
        entry.total += row.total;
        if (GENDERS.includes(row.genero)) entry[row.genero] += row.total;
        counts.set(row.rango, entry);
    }

    const ranges = [...BUCKETS.map(({ id, label }) => ({ id, label })), { id: 'sin_dato', label: 'Sin fecha registrada' }]
        .map(({ id, label }) => {
            const raw = counts.get(id) || { total: 0, femenino: 0, masculino: 0 };
            if (isSmall(raw.total)) return { id, label, total: null, oculto: true, por_genero: null };
            const splitHidden = GENDERS.some((gender) => isSmall(raw[gender]));
            return {
                id, label, total: raw.total, oculto: false,
                por_genero: splitHidden ? null : { femenino: raw.femenino, masculino: raw.masculino }
            };
        });

    const anyHidden = ranges.some((range) => range.oculto);
    const grandTotal = ranges.reduce((sum, range) => sum + (range.total || 0), 0);
    return {
        total: anyHidden ? null : grandTotal,
        rangos: ranges,
        grupo_minimo: MIN_GROUP_SIZE,
        nota: `Por protección de datos, los grupos de menos de ${MIN_GROUP_SIZE} personas se muestran como "<${MIN_GROUP_SIZE}".`
    };
};

const getDemographics = async (db, idInstitucion = null) => {
    const { rows } = await db.query(SQL, [idInstitucion]);
    return buildDemographics(rows);
};

module.exports = { MIN_GROUP_SIZE, buildDemographics, getDemographics };
