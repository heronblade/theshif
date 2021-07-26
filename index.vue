<template>
  <div :class="`dashboard-page sandbox-page page load-${loading}`">
    <div class="contents">
      <div id="dashboard"></div>
    </div>
  </div>
</template>

<script>
/**
 * Examples are here https://gallery.keshif.me/NYPL
 * just replace NYPL with html file name
 */
import { mapGetters } from 'vuex';
import loading from '@/components/_utils/loading';
import { outOfStock, getDataAfterRefresh } from '@/utils/seccam';
import kshf from './keshif/index';

export default {
  name: 'dashboards',
  components: {
    loading,
  },
  data() {
    return {
      loading: true,
    };
  },
  methods: {
    /**
     * Get the config object from the store, and then build the necessary
     * object for the browser
     */
    getData() {
      // console.log('get data');
      this.loading = false;
      const config = this.$plotlyUtils.deepCopyObj(this.dashboardConfig);
      new kshf.Browser({
        domID: `${config.domID}`,
        barChartWidth: config.barChartWidth,
        leftPanelLabelWidth: config.leftPanelLabelWidth,
        recordName: `${config.recordName}`,
        source: config.source,
        onLoad() {
          // eslint-disable-next-line
          config.onLoad
        },
        summaries: config.summaries,
        // TODO: figure out how to pick graph type.
        // what's in the middle
        recordDisplay: config.recordDisplay,
      });
    },
  },
  /**
   * Things we do when the page is loaded
   * @return {[type]} [description]
   */
  mounted() {
    /**
     * This handles a use case where a page is refreshed but the Auth0 call
     * that set's the state for the user isn't completed by the time the
     * page is rendered due to it being asynchronous.
     * We catch the change of the user state by using a watcher below
     * the outOfStock function will check to see if the state.user.thapps has been populated
     * before executing the callback this.gatData(). This allowed for the normal use of the
     * side navigation and will execute as expected
     */

    // outOfStock(this.$store, this.user.thapps, () => this.getData());
    // outOfStock(this.$store, () => this.getData());
  },
  computed: {
    ...mapGetters('authentication', {
      user: 'user',
    }),
    ...mapGetters('tho', {
      dashboardConfig: 'getDashboardConfig',
    }),
  },
  watch: {
    user() {
      // console.log('user change');
      getDataAfterRefresh(this.$store, () => this.getData());
    },
    dashboardConfig() {
      // console.log('dashboard config');
      this.getData();
    },
  },
};
</script>
