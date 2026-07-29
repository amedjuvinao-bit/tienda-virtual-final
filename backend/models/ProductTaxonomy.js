'use strict';

const mongoose = require('mongoose');
const {
  cleanMultiline,
  cleanText,
  slugify,
} = require('../lib/products/productCommercialConfig');

const TAXONOMY_KINDS = Object.freeze([
  'category',
  'collection',
]);

const productTaxonomySchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: TAXONOMY_KINDS,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductTaxonomy',
      default: null,
      index: true,
    },
    image: {
      type: String,
      trim: true,
      default: '',
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
    seo: {
      title: {
        type: String,
        trim: true,
        default: '',
      },
      description: {
        type: String,
        trim: true,
        default: '',
      },
    },
    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

productTaxonomySchema.index(
  { kind: 1, slug: 1 },
  {
    unique: true,
    partialFilterExpression: {
      archivedAt: null,
      slug: { $type: 'string', $ne: '' },
    },
  }
);
productTaxonomySchema.index({
  kind: 1,
  archivedAt: 1,
  active: 1,
  parent: 1,
  sortOrder: 1,
  name: 1,
});

productTaxonomySchema.pre(
  'validate',
  function normalizeTaxonomy(next) {
    try {
      this.kind = cleanText(this.kind, 20).toLowerCase();
      this.name = cleanText(this.name, 120);
      this.slug = slugify(this.slug || this.name, 120);
      this.description = cleanMultiline(this.description, 800);
      this.image = cleanText(this.image, 1000);
      this.sortOrder = Math.max(
        0,
        Math.floor(Number(this.sortOrder || 0))
      );
      this.seo = {
        title: cleanText(this.seo?.title, 70),
        description: cleanMultiline(
          this.seo?.description,
          320
        ),
      };

      if (this.kind === 'collection') {
        this.parent = null;
      }

      next();
    } catch (error) {
      next(error);
    }
  }
);

productTaxonomySchema.statics.KINDS = TAXONOMY_KINDS;

module.exports =
  mongoose.models.ProductTaxonomy ||
  mongoose.model('ProductTaxonomy', productTaxonomySchema);
