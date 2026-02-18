import { config, fields, collection } from '@keystatic/core';

export default config({
    storage: {
        kind: 'local',
    },
    collections: {
        blog: collection({
            label: 'Blog',
            slugField: 'title',
            path: 'src/content/blog/*',
            format: { data: 'yaml', contentField: 'content' },
            schema: {
                title: fields.slug({ name: { label: 'Titre' } }),
                excerpt: fields.text({ label: 'Extrait' }),
                image: fields.text({ label: 'URL de l\'image' }),
                date: fields.date({ label: 'Date' }),
                category: fields.text({ label: 'Catégorie' }),
                content: fields.markdoc({ label: 'Contenu' }),
            },
        }),
        hajj: collection({
            label: 'Hajj',
            slugField: 'title',
            path: 'src/content/hajj/*',
            format: { data: 'yaml', contentField: 'content' },
            schema: {
                title: fields.slug({ name: { label: 'Titre' } }),
                description: fields.text({ label: 'Description' }),
                image: fields.text({ label: 'URL de l\'image' }),
                price: fields.text({ label: 'Prix' }),
                duration: fields.text({ label: 'Durée' }),
                features: fields.array(fields.text({ label: 'Caractéristique' }), {
                    itemLabel: (props) => props.value,
                }),
                pdfUrl: fields.text({ label: 'URL du PDF (Optionnel)' }),
                availabilityNote: fields.text({ label: 'Note de disponibilité (Optionnel)' }),
                content: fields.markdoc({ label: 'Contenu (Optionnel)' }),
            },
        }),
        omra: collection({
            label: 'Omra',
            slugField: 'title',
            path: 'src/content/omra/*',
            format: { data: 'yaml', contentField: 'content' },
            schema: {
                title: fields.slug({ name: { label: 'Titre' } }),
                description: fields.text({ label: 'Description' }),
                image: fields.text({ label: 'URL de l\'image' }),
                price: fields.text({ label: 'Prix' }),
                duration: fields.text({ label: 'Durée' }),
                features: fields.array(fields.text({ label: 'Caractéristique' }), {
                    itemLabel: (props) => props.value,
                }),
                pdfUrl: fields.text({ label: 'URL du PDF (Optionnel)' }),
                availabilityNote: fields.text({ label: 'Note de disponibilité (Optionnel)' }),
                content: fields.markdoc({ label: 'Contenu (Optionnel)' }),
            },
        }),
        voyages: collection({
            label: 'Voyages',
            slugField: 'title',
            path: 'src/content/voyages/*',
            format: { data: 'yaml', contentField: 'content' },
            schema: {
                title: fields.slug({ name: { label: 'Titre' } }),
                description: fields.text({ label: 'Description' }),
                image: fields.text({ label: 'URL de l\'image' }),
                price: fields.text({ label: 'Prix' }),
                duration: fields.text({ label: 'Durée' }),
                features: fields.array(fields.text({ label: 'Caractéristique' }), {
                    itemLabel: (props) => props.value,
                }),
                pdfUrl: fields.text({ label: 'URL du PDF (Optionnel)' }),
                availabilityNote: fields.text({ label: 'Note de disponibilité (Optionnel)' }),
                content: fields.markdoc({ label: 'Contenu (Optionnel)' }),
            },
        }),
        gallery: collection({
            label: 'Galerie',
            slugField: 'title',
            path: 'src/content/gallery/*',
            format: { data: 'yaml', contentField: 'content' },
            schema: {
                title: fields.slug({ name: { label: 'Titre' } }),
                description: fields.text({ label: 'Description (Optionnel)' }),
                mediaUrl: fields.text({ label: 'Lien Vidéo/Image (URL externe)' }),
                videoFile: fields.file({
                    label: 'Fichier Vidéo (Upload direct)',
                    directory: 'public/uploads/videos',
                    publicPath: '/uploads/videos/',
                }),
                galleryImages: fields.array(
                    fields.image({
                        label: 'Image',
                        directory: 'src/assets/pics',
                        publicPath: '../../assets/pics/',
                    }),
                    {
                        label: 'Galerie d\'images (Upload direct)',
                        itemLabel: (props) => 'Image',
                    }
                ),
                mediaUrls: fields.array(fields.text({ label: 'URL Média' }), {
                    label: 'Liens Médias (Multiples URLs)',
                    itemLabel: (props) => props.value,
                }),
                mediaType: fields.select({
                    label: 'Type de média',
                    options: [
                        { label: 'Image', value: 'image' },
                        { label: 'Vidéo', value: 'video' },
                        { label: 'Carousel', value: 'carousel' },
                    ],
                    defaultValue: 'image',
                }),
                thumbnailUrl: fields.text({ label: 'URL de la miniature (Optionnel)' }),
                category: fields.text({ label: 'Catégorie (Optionnel)' }),
                location: fields.text({ label: 'Lieu (Optionnel)' }),
                date: fields.date({ label: 'Date (Optionnel)' }),
                content: fields.markdoc({ label: 'Contenu (Optionnel)' }),
            },
        }),
    },
});
