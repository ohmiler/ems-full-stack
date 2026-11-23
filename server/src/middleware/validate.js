/**
 * ตรวจ req[source] ด้วย zod schema แล้วเก็บผลไว้ที่ req.valid[source]
 * (Express 5 ไม่ให้เขียนทับ req.query จึงแยกเก็บต่างหาก)
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source] ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'ข้อมูลไม่ถูกต้อง',
        details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    }
    req.valid = { ...req.valid, [source]: parsed.data };
    next();
  };
}
