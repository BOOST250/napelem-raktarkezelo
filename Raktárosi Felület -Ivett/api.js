const Api = {

    async projektek() {
        return MockBackend.projektek;
    },

    async projektAlkatreszek(projektId) {
        return MockBackend.alkatreszek.filter(
            a => a.projektId === projektId
        );
    }

};