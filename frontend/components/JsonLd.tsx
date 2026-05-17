/**
 * Микроразметка Schema.org в виде <script type="application/ld+json">.
 * Экранирует «<», чтобы значение, содержащее «</script>», не разорвало
 * тег и не сломало страницу.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
