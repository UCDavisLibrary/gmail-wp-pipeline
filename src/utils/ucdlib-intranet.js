import config from './config.js';
import logger from './logger.js';
import wp from './wp.js';

/**
 * @description Customizations for the uc davis library intranet
 * It is just a little cumbersome to have this in the config file
 * - Applies category to message based on sender email defined in this.categoryMapping
 */
export default class UcdlibIntranet {

  constructor(message, payload){
    this.active = config.customScript === 'ucdlib-intranet';
    if ( !this.active ) return;

    this.message = message;
    this.payload = payload;

    this.categoryMapping = [
      {
        categorySlug: 'human-resources',
        categoryName: 'Human Resources',
        senderEmails: [
          'libraryhr'
        ]
      },
      {
        categorySlug: 'university-librarian',
        categoryName: 'University Librarian',
        senderEmails: [
          'wfgarrity'
        ]
      }
    ];

    for ( const cat of this.categoryMapping ) {
      if ( !cat.senderEmails.length ) continue;
      cat.senderEmails = cat.senderEmails.map( email => {
        if ( Array.isArray(email) ) {
          return email.join('@');
        }
        if ( !email.includes('@') ) {
          return email + '@ucdavis.edu';
        }
        return email;
      });
    }

    this.categoriesCreated = [];
  }

  async runIfActive(){
    if ( !this.active ) return;
    logger.info('Running UcdlibIntranet script', {data: this.message.loggerInfo});
    const { email } = this.message.parseSender();
    const categories = this.categoryMapping.filter( cat => {
      return cat.senderEmails.includes(email);
    });
    if ( !categories.length ) {
      logger.info('No categories found for this email', {data: this.message.loggerInfo});
      return;
    }

    this.payload.categories = [];
    for ( const cat of categories ) {
      logger.info('Checking if category exists', {data: {email: this.message.loggerInfo, category: cat.categorySlug}});
      const searchRes = await wp.findCategory(cat.categorySlug);
      let wpCat = searchRes.find( c => c.slug == cat.categorySlug );
      if ( !wpCat ) {
        logger.info('Category not found. Creating it', {data: {email: this.message.loggerInfo, category: cat.categorySlug}});
        wpCat = await wp.createCategory({
          name: cat.categoryName,
          slug: cat.categorySlug
        });
        this.categoriesCreated.push(wpCat);
      } else {
        logger.info('Category found', {data: {email: this.message.loggerInfo, category: cat.categorySlug}});
      }
      logger.info('Adding category to payload', {data: {email: this.message.loggerInfo, category: cat.categorySlug}});
      this.payload.categories.push(wpCat.id);
    }
  }

  async cleanup(){
    if ( !this.active ) return;
    if ( !this.categoriesCreated.length ) return;
    for ( const cat of this.categoriesCreated ) {
      await wp.deleteCategory(cat.id);
    }
  }
}
