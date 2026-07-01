import { config, fields, collection } from '@keystatic/core';

// Shared schema for travel programs (Hajj, Omra, Voyages)
const commonProgramFields = {
    title: fields.slug({ name: { label: 'Titre / العنوان' } }),
    description: fields.text({ label: 'Description courte / وصف قصير' }),
    image: fields.text({ label: 'Lien de l\'image (URL) / رابط الصورة' }),
    price: fields.text({ label: 'Prix (ex: 21000 DH) / السعر' }),
    duration: fields.text({ label: 'Durée (ex: 15 jours) / المدة' }),
    features: fields.array(fields.text({ label: 'Caractéristique / ميزة أو خدمة' }), {
        label: 'Caractéristiques du programme / مميزات البرنامج',
        itemLabel: (props) => props.value || 'Caractéristique / ميزة',
    }),
    pdfUrl: fields.text({ label: 'Lien du PDF du programme (Optionnel) / رابط ملف البرنامج PDF (اختياري)' }),
    availabilityNote: fields.text({ label: 'Note de disponibilité (ex: Places limitées) / ملاحظة حول التوفر (اختياري)' }),
    content: fields.markdoc({ label: 'Description détaillée (Contenu) / التفاصيل الكاملة للبرنامج' }),
};

export default config({
    storage: {
        kind: 'local',
    },
    collections: {
        blog: collection({
            label: 'Blog / المدونة',
            slugField: 'title',
            path: 'src/content/blog/*',
            format: { data: 'yaml', contentField: 'content' },
            schema: {
                title: fields.slug({ name: { label: 'Titre / العنوان' } }),
                excerpt: fields.text({ label: 'Extrait / مقتطف قصير' }),
                image: fields.text({ label: 'Lien de l\'image (URL) / رابط الصورة' }),
                date: fields.date({ label: 'Date / التاريخ' }),
                category: fields.text({ label: 'Catégorie / التصنيف' }),
                content: fields.markdoc({ label: 'Contenu de l\'article / محتوى المقال' }),
            },
        }),
        hajj: collection({
            label: 'Hajj / الحج',
            slugField: 'title',
            path: 'src/content/hajj/*',
            format: { data: 'yaml', contentField: 'content' },
            schema: commonProgramFields,
        }),
        omra: collection({
            label: 'Omra / العمرة',
            slugField: 'title',
            path: 'src/content/omra/*',
            format: { data: 'yaml', contentField: 'content' },
            schema: commonProgramFields,
        }),
        voyages: collection({
            label: 'Voyages Organisés / الرحلات المنظمة',
            slugField: 'title',
            path: 'src/content/voyages/*',
            format: { data: 'yaml', contentField: 'content' },
            schema: {
                ...commonProgramFields,
                destination: fields.select({
                    label: 'Destination / الوجهة',
                    description: 'Sélectionnez la destination pour le filtrage / اختر وجهة السفر لتصفية النتائج',
                    options: [
                        { label: 'Turquie / تركيا', value: 'Turquie' },
                        { label: 'Espagne / إسبانيا', value: 'Espagne' },
                        { label: 'Maroc / المغرب', value: 'Maroc' },
                        { label: 'Jordanie / الأردن', value: 'Jordanie' },
                        { label: 'Egypte / مصر', value: 'Egypte' },
                        { label: 'Ouzbékistan / أوزبكستان', value: 'Ouzbékistan' },
                        { label: 'Malaisie / ماليزيا', value: 'Malaisie' },
                        { label: 'Indonésie / إندونيسيا', value: 'Indonésie' },
                        { label: 'Thaïlande / تايلاند', value: 'Thaïlande' },
                        { label: 'Dubai / دبي', value: 'Dubai' },
                    ],
                    defaultValue: 'Turquie',
                }),
            },
        }),
        gallery: collection({
            label: 'Galerie Photos & Vidéos / معرض الصور والفيديوهات',
            slugField: 'title',
            path: 'src/content/gallery/*',
            format: { data: 'yaml', contentField: 'content' },
            schema: {
                title: fields.slug({ name: { label: 'Titre / العنوان' } }),
                description: fields.text({ label: 'Description (Optionnel) / وصف قصير (اختياري)' }),
                media: fields.conditional(
                    fields.select({
                        label: 'Type de média / نوع الوسائط',
                        options: [
                            { label: 'Image unique (Upload local) / صورة واحدة (تحميل من جهازك)', value: 'image-local' },
                            { label: 'Image unique (Lien URL) / صورة واحدة (رابط من الإنترنت)', value: 'image-external' },
                            { label: 'Vidéo (Upload local) / فيديو (تحميل من جهازك)', value: 'video-local' },
                            { label: 'Vidéo (Lien URL) / فيديو (رابط من الإنترنت)', value: 'video-external' },
                            { label: 'Galerie d\'images (Carrousel) / مجموعة صور (تحميل)', value: 'carousel' },
                        ],
                        defaultValue: 'image-local',
                    }),
                    {
                        'image-local': fields.image({
                            label: 'Sélectionner l\'image / اختر الصورة للتحميل',
                            directory: 'src/assets/pics',
                            publicPath: '../../assets/pics/',
                        }),
                        'image-external': fields.text({
                            label: 'Lien direct de l\'image (URL) / اكتب رابط الصورة هنا',
                        }),
                        'video-local': fields.file({
                            label: 'Fichier Vidéo (MP4) / اختر ملف الفيديو للتحميل',
                            directory: 'public/uploads/videos',
                            publicPath: '/uploads/videos/',
                        }),
                        'video-external': fields.text({
                            label: 'Lien direct de la vidéo (URL) / اكتب رابط الفيديو هنا',
                        }),
                        'carousel': fields.array(
                            fields.image({
                                label: 'Image / صورة',
                                directory: 'src/assets/pics',
                                publicPath: '../../assets/pics/',
                            }),
                            {
                                label: 'Images du carrousel / اختر مجموعة صور للتحميل',
                                itemLabel: (props) => 'Image',
                            }
                        ),
                    }
                ),
                thumbnailUrl: fields.text({ label: 'URL de la miniature (Optionnel) / رابط غلاف الفيديو أو المعرض (اختياري)' }),
                category: fields.text({ label: 'Catégorie (ex: العمرة 2026) / التصنيف (اختياري)' }),
                location: fields.text({ label: 'Lieu (ex: مكة المكرمة) / المكان (اختياري)' }),
                date: fields.date({ label: 'Date (Optionnel) / التاريخ (اختياري)' }),
                content: fields.markdoc({ label: 'Détails ou contenu supplémentaire (Optionnel) / تفاصيل إضافية (اختياري)' }),
            },
        }),
    },
});
